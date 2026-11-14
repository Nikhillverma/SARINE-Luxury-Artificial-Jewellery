import { Router } from "express";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import Razorpay from "razorpay";
import { pool } from "./db.js";

const router = Router();

import { calculateShippingFee, getCheckoutConfig } from "./checkoutPolicy.js";
import { ensureMarketingSchema, lockAndValidateCoupon, reserveCouponRedemption, releaseCouponReservation, confirmCouponRedemption } from "./marketingPolicy.js";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function timingSafeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return crypto.timingSafeEqual(bufA, bufB);
}

function getRazorpay() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error(
      "Razorpay credentials are not configured on the server. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
    );
  }
  return new Razorpay({ key_id, key_secret });
}

// Rate limiter for public order tracking
const trackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many tracking attempts. Please try again later." }
});

// POST /api/orders/create (and /api/create-order)
router.post("/create", async (req, res, next) => {
  let connection;
  try {
    const { items, customer, shippingAddress, paymentMethod, couponCode } = req.body || {};

    // 1. Validate customer details
    if (!customer?.name || String(customer.name).trim().length < 2) {
      return res.status(400).json({ error: "Please enter a valid customer name." });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!customer.email || !emailRegex.test(String(customer.email).trim())) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }
    const cleanCustomerPhone = String(customer.phone || "").replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleanCustomerPhone)) {
      return res.status(400).json({
        error: "Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9."
      });
    }

    // 2. Validate shipping address
    if (!shippingAddress?.fullName || String(shippingAddress.fullName).trim().length < 2) {
      return res.status(400).json({ error: "Please enter a recipient full name." });
    }
    const cleanShippingPhone = String(shippingAddress.phone || "").replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleanShippingPhone)) {
      return res.status(400).json({ error: "Please enter a valid recipient 10-digit mobile number." });
    }
    if (!shippingAddress.line1 || String(shippingAddress.line1).trim().length < 3) {
      return res.status(400).json({ error: "Please enter street address / house details." });
    }
    if (!shippingAddress.city || String(shippingAddress.city).trim().length < 2) {
      return res.status(400).json({ error: "Please enter delivery city." });
    }
    if (!shippingAddress.state || String(shippingAddress.state).trim().length < 2) {
      return res.status(400).json({ error: "Please select your state." });
    }
    const cleanPincode = String(shippingAddress.pincode || "").trim();
    if (!/^[1-9][0-9]{5}$/.test(cleanPincode)) {
      return res.status(400).json({ error: "Please enter a valid 6-digit postal PIN code." });
    }

    // 3. Validate payment method
    if (paymentMethod !== "online" && paymentMethod !== "cod") {
      return res.status(400).json({ error: "Invalid payment method." });
    }
    const checkoutConfig = await getCheckoutConfig();
    if (paymentMethod === "cod" && !checkoutConfig.codEnabled) {
      return res.status(400).json({
        error: "Cash on Delivery is currently unavailable. Please choose online payment."
      });
    }

    // 4. Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Your shopping bag is empty." });
    }
    for (const itm of items) {
      if (!itm.productId || typeof itm.productId !== "string") {
        return res.status(400).json({ error: "Invalid product in order list." });
      }
      if (!Number.isInteger(Number(itm.quantity)) || Number(itm.quantity) <= 0) {
        return res.status(400).json({ error: "Product quantity must be a positive integer." });
      }
    }

    await ensureMarketingSchema();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 5. Authoritative price and stock check in MariaDB
    const verifiedLines = [];
    let calculatedSubtotal = 0;
    for (let i = 0; i < items.length; i++) {
      const itm = items[i];
      const [pRows] = await connection.execute(
        `SELECT id, name, price, stock, status, images
         FROM products
         WHERE id = ?
         FOR UPDATE`,
        [itm.productId]
      );
      if (!pRows.length) {
        await connection.rollback();
        connection.release();
        connection = null;
        return res.status(400).json({ error: "One or more items in your bag could not be found." });
      }
      const p = pRows[0];
      if (p.status !== "active") {
        await connection.rollback();
        connection.release();
        connection = null;
        return res.status(400).json({
          error: `"${p.name || 'Selected item'}" is no longer active in our collection.`
        });
      }
      const availableStock = Number(p.stock || 0);
      if (availableStock <= 0) {
        await connection.rollback();
        connection.release();
        connection = null;
        return res.status(400).json({ error: `"${p.name}" is currently out of stock.` });
      }
      if (Number(itm.quantity) > availableStock) {
        await connection.rollback();
        connection.release();
        connection = null;
        return res.status(400).json({
          error: `Only ${availableStock} ${availableStock === 1 ? 'piece is' : 'pieces are'} available for "${p.name}".`
        });
      }
      const unitPrice = Math.round(Number(p.price) || 0);
      calculatedSubtotal += unitPrice * Number(itm.quantity);
      let images = [];
      try {
        images = typeof p.images === "string" ? JSON.parse(p.images) : (p.images || []);
      } catch {}
      verifiedLines.push({
        productId: p.id,
        name: p.name,
        unitPrice,
        quantity: Number(itm.quantity),
        image: Array.isArray(images) && images[0] ? String(images[0]) : "",
        sku: null, // The live products table has no SKU column.
        sourceLine: i
      });
    }

    let coupon = null;
    let discountAmount = 0;
    try {
      const validatedCoupon = await lockAndValidateCoupon(connection, couponCode, calculatedSubtotal, customer.email);
      coupon = validatedCoupon.coupon;
      discountAmount = validatedCoupon.discountAmount;
    } catch (couponError) {
      await connection.rollback();
      connection.release();
      connection = null;
      return res.status(400).json({ error: couponError.message || "Coupon could not be applied." });
    }
    const shippingFee = calculateShippingFee(calculatedSubtotal, checkoutConfig);
    const total = Math.max(0, calculatedSubtotal - discountAmount) + shippingFee;

    // 6. Concurrency-safe counter allocation
    await connection.execute(
      `INSERT INTO counters (name, seq, updated_at)
       VALUES ('orders', 0, UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE name = name`
    );

    const [counterRows] = await connection.execute(
      `SELECT seq FROM counters WHERE name = 'orders' FOR UPDATE`
    );

    const [maxOrderRows] = await connection.execute(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(order_number, 5) AS UNSIGNED)), 0) AS max_order_seq
       FROM orders
       WHERE order_number LIKE 'SAR-%'`
    );

    const currentCounterSeq = Number(counterRows[0]?.seq || 0);
    const maxExistingSeq = Number(maxOrderRows[0]?.max_order_seq || 0);
    const currentCeiling = Math.max(currentCounterSeq, maxExistingSeq, 124);
    let allocatedSeq = currentCeiling + 1;
    let candidateOrderNumber = `SAR-${String(allocatedSeq).padStart(6, '0')}`;

    while (true) {
      const [existing] = await connection.execute(
        `SELECT id FROM orders WHERE order_number = ? FOR UPDATE`,
        [candidateOrderNumber]
      );
      if (!existing.length) break;
      allocatedSeq += 1;
      candidateOrderNumber = `SAR-${String(allocatedSeq).padStart(6, '0')}`;
    }

    await connection.execute(
      `UPDATE counters SET seq = ?, updated_at = UTC_TIMESTAMP(3) WHERE name = 'orders'`,
      [allocatedSeq]
    );

    const orderNumber = candidateOrderNumber;
    const publicToken = crypto.randomBytes(32).toString("hex");
    const publicTokenHash = hashToken(publicToken);

    const serializedShippingAddress = JSON.stringify({
      fullName: String(shippingAddress.fullName).trim(),
      phone: cleanShippingPhone,
      line1: String(shippingAddress.line1).trim(),
      line2: shippingAddress.line2 ? String(shippingAddress.line2).trim() : "",
      city: String(shippingAddress.city).trim(),
      state: String(shippingAddress.state).trim(),
      pincode: cleanPincode
    });

    // 7. Insert Order record and items based on paymentMethod
    if (paymentMethod === "cod") {
      // Deduct stock immediately for COD
      for (const line of verifiedLines) {
        await connection.execute(
          `UPDATE products SET stock = stock - ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?`,
          [line.quantity, line.productId]
        );
      }

      await connection.execute(
        `INSERT INTO orders (
           id, order_number, customer_id, customer_name, customer_email, customer_phone,
           shipping_address, subtotal, shipping_fee, total, coupon_code, discount_amount, payment_method,
           payment_status, order_status, public_token_hash, source_document, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cod', 'pending', 'placed', ?, 'web_checkout', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [
          orderNumber,
          orderNumber,
          customer.userId || null,
          String(customer.name).trim(),
          String(customer.email).trim().toLowerCase(),
          cleanCustomerPhone,
          serializedShippingAddress,
          calculatedSubtotal,
          shippingFee,
          total,
          coupon?.code || null,
          discountAmount,
          publicTokenHash
        ]
      );

      for (const line of verifiedLines) {
        await connection.execute(
          `INSERT INTO order_items (order_id, product_id, product_name, sku, unit_price, quantity, image, source_line)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [orderNumber, line.productId, line.name, line.sku, line.unitPrice, line.quantity, line.image, line.sourceLine]
        );
      }

      await connection.execute(
        `INSERT INTO order_status_history (order_id, old_status, new_status, note, changed_by, created_at)
         VALUES (?, NULL, 'placed', 'Order placed via COD', 'customer', UTC_TIMESTAMP(3))`,
        [orderNumber]
      );
      await reserveCouponRedemption(connection, coupon, orderNumber, customer.email, discountAmount, "redeemed");

      await connection.commit();
      connection.release();
      connection = null;

      return res.json({
        orderNumber,
        publicToken,
        orderStatus: "placed",
        subtotal: calculatedSubtotal,
        shippingFee,
        discountAmount,
        couponCode: coupon?.code || null,
        total
      });
    } else {
      // Prepaid (Online): Create order in awaiting_payment state WITHOUT deducting stock
      await connection.execute(
        `INSERT INTO orders (
           id, order_number, customer_id, customer_name, customer_email, customer_phone,
           shipping_address, subtotal, shipping_fee, total, coupon_code, discount_amount, payment_method,
           payment_status, order_status, public_token_hash, source_document, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', 'pending', 'awaiting_payment', ?, 'web_checkout', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [
          orderNumber,
          orderNumber,
          customer.userId || null,
          String(customer.name).trim(),
          String(customer.email).trim().toLowerCase(),
          cleanCustomerPhone,
          serializedShippingAddress,
          calculatedSubtotal,
          shippingFee,
          total,
          publicTokenHash
        ]
      );

      for (const line of verifiedLines) {
        await connection.execute(
          `INSERT INTO order_items (order_id, product_id, product_name, sku, unit_price, quantity, image, source_line)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [orderNumber, line.productId, line.name, line.sku, line.unitPrice, line.quantity, line.image, line.sourceLine]
        );
      }

      await connection.execute(
        `INSERT INTO order_status_history (order_id, old_status, new_status, note, changed_by, created_at)
         VALUES (?, NULL, 'awaiting_payment', 'Order created awaiting Razorpay payment', 'customer', UTC_TIMESTAMP(3))`,
        [orderNumber]
      );
      await reserveCouponRedemption(connection, coupon, orderNumber, customer.email, discountAmount, "reserved");

      await connection.commit();
      connection.release();
      connection = null;

      // 8. Outside DB transaction: Create Razorpay Order
      const amountInPaise = Math.round(total * 100);
      let rpOrder;
      try {
        const razorpay = getRazorpay();
        rpOrder = await razorpay.orders.create({
          amount: amountInPaise,
          currency: "INR",
          receipt: orderNumber,
          notes: {
            orderNumber,
            customerName: String(customer.name).trim().slice(0, 40)
          }
        });
      } catch (rpErr) {
        console.error("[orders.create] Razorpay order creation failed:", rpErr.message);
        await pool.execute(
          `UPDATE orders SET payment_status = 'failed', order_status = 'failed', cancellation_reason = ? WHERE id = ?`,
          [rpErr.message || "Gateway order initialization failed", orderNumber]
        );
        await pool.execute(
          `INSERT INTO order_status_history (order_id, old_status, new_status, note, changed_by, created_at)
           VALUES (?, 'awaiting_payment', 'failed', 'Payment gateway order creation failed', 'system', UTC_TIMESTAMP(3))`,
          [orderNumber]
        );
        await releaseCouponReservation(orderNumber);
        return res.status(500).json({
          error: "Unable to initiate payment with the payment gateway. Please try again."
        });
      }

      await pool.execute(
        `UPDATE orders
         SET razorpay_order_id = ?, razorpay_amount_paise = ?, razorpay_key_id = ?, updated_at = UTC_TIMESTAMP(3)
         WHERE id = ?`,
        [rpOrder.id, amountInPaise, process.env.RAZORPAY_KEY_ID || "", orderNumber]
      );

      return res.json({
        orderNumber,
        publicToken,
        razorpayOrderId: rpOrder.id,
        amount: amountInPaise,
        keyId: process.env.RAZORPAY_KEY_ID,
        subtotal: calculatedSubtotal,
        shippingFee,
        discountAmount,
        couponCode: coupon?.code || null,
        total
      });
    }
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    next(error);
  }
});

// POST /api/orders/verify (and /api/verify-payment)
router.post("/verify", async (req, res, next) => {
  let connection;
  try {
    const {
      orderNumber,
      publicToken,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body || {};

    if (!publicToken || typeof publicToken !== "string" || !publicToken.trim()) {
      return res.status(403).json({ error: "Unauthorized access to order verification." });
    }
    if (!orderNumber || typeof orderNumber !== "string" || !orderNumber.trim()) {
      return res.status(400).json({ error: "Order number is required." });
    }
    const cleanOrderNumber = orderNumber.trim();
    const cleanPublicToken = publicToken.trim();

    const RAZORPAY_PAYMENT_ID_REGEX = /^pay_[A-Za-z0-9]+$/;
    if (
      !razorpay_payment_id ||
      typeof razorpay_payment_id !== "string" ||
      !RAZORPAY_PAYMENT_ID_REGEX.test(razorpay_payment_id)
    ) {
      return res.status(400).json({ error: "Invalid or missing Razorpay payment ID." });
    }
    if (!razorpay_order_id || typeof razorpay_order_id !== "string" || !razorpay_order_id.trim()) {
      return res.status(400).json({ error: "Missing Razorpay order ID." });
    }
    if (!razorpay_signature || typeof razorpay_signature !== "string" || !razorpay_signature.trim()) {
      return res.status(400).json({ error: "Missing Razorpay payment signature." });
    }

    // 1. Verify digital signature using RAZORPAY_KEY_SECRET outside database transaction
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return res.status(500).json({ error: "Payment verification is unconfigured on the server." });
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (!timingSafeCompare(expectedSignature, razorpay_signature)) {
      return res.status(400).json({ error: "Payment signature validation failed." });
    }

    // 2. Fetch payment record from Razorpay API outside database transaction
    const razorpay = getRazorpay();
    let paymentRecord;
    try {
      paymentRecord = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (fetchErr) {
      console.error("[orders.verify] Razorpay payments.fetch error:", fetchErr.message);
      return res.status(500).json({
        error: "Something went wrong verifying payment with the gateway. Please try again."
      });
    }

    if (!paymentRecord) {
      return res.status(400).json({ error: "Payment record was not returned by gateway." });
    }
    if (paymentRecord.order_id !== razorpay_order_id) {
      return res.status(400).json({ error: "Payment does not belong to this order." });
    }
    if (paymentRecord.currency !== "INR") {
      return res.status(400).json({ error: "Payment currency must be INR." });
    }
    if (paymentRecord.status === "authorized") {
      return res.json({
        success: false,
        pending: true,
        message: "Your payment is being confirmed."
      });
    }
    if (paymentRecord.status !== "captured") {
      return res.status(400).json({ error: `Payment is in invalid status: ${paymentRecord.status}` });
    }

    // 3. Atomic database transaction for stock decrement and payment confirmation
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [orderRows] = await connection.execute(
      `SELECT * FROM orders WHERE order_number = ? FOR UPDATE`,
      [cleanOrderNumber]
    );

    if (!orderRows.length) {
      await connection.rollback();
      connection.release();
      connection = null;
      return res.status(404).json({ error: "We could not find the specified order." });
    }

    const order = orderRows[0];
    const expectedTokenHash = hashToken(cleanPublicToken);
    if (!timingSafeCompare(order.public_token_hash, expectedTokenHash)) {
      await connection.rollback();
      connection.release();
      connection = null;
      return res.status(403).json({ error: "Unauthorized access to order verification." });
    }

    if (order.payment_method !== "online") {
      await connection.rollback();
      connection.release();
      connection = null;
      return res.status(400).json({ error: "This order does not require online payment." });
    }

    // Idempotency: if already paid, return success immediately
    if (order.payment_status === "paid") {
      await connection.commit();
      connection.release();
      connection = null;
      return res.json({
        success: true,
        orderNumber: cleanOrderNumber,
        paymentStatus: "paid",
        orderStatus: order.order_status,
        alreadyProcessed: true
      });
    }

    const expectedAmountPaise = Number(
      order.razorpay_amount_paise || Math.round(Number(order.total) * 100)
    );
    if (Number(paymentRecord.amount) !== expectedAmountPaise) {
      await connection.rollback();
      connection.release();
      connection = null;
      return res.status(400).json({ error: "Payment amount mismatch with order total." });
    }

    // Lock product items
    const [orderItems] = await connection.execute(
      `SELECT product_id, quantity, product_name FROM order_items WHERE order_id = ?`,
      [order.id]
    );

    let hasSufficientStock = true;
    for (const item of orderItems) {
      const [prod] = await connection.execute(
        `SELECT id, stock FROM products WHERE id = ? FOR UPDATE`,
        [item.product_id]
      );
      if (!prod.length || Number(prod[0].stock || 0) < Number(item.quantity)) {
        hasSufficientStock = false;
        break;
      }
    }

    if (hasSufficientStock) {
      // Deduct stock for verified prepaid items
      for (const item of orderItems) {
        await connection.execute(
          `UPDATE products SET stock = stock - ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?`,
          [item.quantity, item.product_id]
        );
      }
      await connection.execute(
        `UPDATE orders
         SET payment_status = 'paid',
             order_status = 'confirmed',
             razorpay_payment_id = ?,
             updated_at = UTC_TIMESTAMP(3)
         WHERE id = ?`,
        [razorpay_payment_id, order.id]
      );
      await connection.execute(
        `INSERT INTO order_status_history (order_id, old_status, new_status, note, changed_by, created_at)
         VALUES (?, ?, 'confirmed', 'Payment verified and captured', 'customer', UTC_TIMESTAMP(3))`,
        [order.id, order.order_status]
      );
      await confirmCouponRedemption(connection, order.id);
      await connection.commit();
      connection.release();
      connection = null;

      return res.json({
        success: true,
        orderNumber: cleanOrderNumber,
        paymentStatus: "paid",
        orderStatus: "confirmed"
      });
    } else {
      // Insufficient stock: mark needs_refund without decrementing stock
      await connection.execute(
        `UPDATE orders
         SET payment_status = 'paid',
             order_status = 'needs_refund',
             refund_needed = 1,
             refund_amount = ?,
             cancellation_reason = 'Stock exhausted between order creation and payment authorization.',
             razorpay_payment_id = ?,
             updated_at = UTC_TIMESTAMP(3)
         WHERE id = ?`,
        [order.total, razorpay_payment_id, order.id]
      );
      await connection.execute(
        `INSERT INTO order_status_history (order_id, old_status, new_status, note, changed_by, created_at)
         VALUES (?, ?, 'needs_refund', 'Stock exhausted between order creation and payment authorization. Flagged for full refund.', 'system', UTC_TIMESTAMP(3))`,
        [order.id, order.order_status]
      );
      await connection.commit();
      connection.release();
      connection = null;

      return res.json({
        success: false,
        needsRefund: true,
        orderNumber: cleanOrderNumber,
        orderStatus: "needs_refund",
        message:
          "Payment was captured, but one or more pieces went out of stock before payment was finalized. Our team has flagged this order for an immediate full refund."
      });
    }
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    next(error);
  }
});

// GET /api/orders/:orderNumber (and /api/get-order)
router.get("/:orderNumber", async (req, res, next) => {
  try {
    const orderNumber = String(req.params.orderNumber || req.query.orderNumber || "").trim();
    const publicToken = String(req.query.t || req.query.publicToken || "").trim();

    if (!orderNumber || !publicToken) {
      return res.status(403).json({ error: "Unauthorized access to order." });
    }

    const expectedHash = hashToken(publicToken);

    const [orderRows] = await pool.execute(
      `SELECT * FROM orders WHERE order_number = ? LIMIT 1`,
      [orderNumber]
    );

    if (!orderRows.length) {
      return res.status(404).json({ error: "Order not found." });
    }

    const order = orderRows[0];
    if (!timingSafeCompare(order.public_token_hash, expectedHash)) {
      return res.status(403).json({ error: "Unauthorized access to order." });
    }

    const [itemRows] = await pool.execute(
      `SELECT id, product_id, product_name, sku, unit_price, quantity, image, source_line
       FROM order_items
       WHERE order_id = ?
       ORDER BY source_line ASC, id ASC`,
      [order.id]
    );

    let parsedAddress = {};
    try {
      parsedAddress = typeof order.shipping_address === "string"
        ? JSON.parse(order.shipping_address)
        : (order.shipping_address || {});
    } catch {}

    const safeOrder = {
      id: order.id,
      orderNumber: order.order_number,
      customer: {
        name: order.customer_name,
        email: order.customer_email,
        phone: order.customer_phone,
        userId: order.customer_id || undefined
      },
      shippingAddress: parsedAddress,
      lines: itemRows.map(row => ({
        productId: row.product_id,
        name: row.product_name,
        unitPrice: Number(row.unit_price),
        quantity: Number(row.quantity),
        image: row.image || "",
        sku: row.sku || undefined
      })),
      subtotal: Number(order.subtotal),
      shippingFee: Number(order.shipping_fee),
      total: Number(order.total),
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      orderStatus: order.order_status,
      createdAt: order.created_at,
      razorpayOrderId: order.razorpay_order_id || undefined,
      razorpayPaymentId: order.payment_status === "paid" ? (order.razorpay_payment_id || undefined) : undefined,
      courierName: order.courier_name || undefined,
      trackingNumber: order.tracking_number || undefined,
      trackingUrl: order.tracking_url || undefined,
      shippedAt: order.shipped_at || undefined,
      deliveredAt: order.delivered_at || undefined,
      estimatedDelivery: order.estimated_delivery || undefined,
      cancelledAt: order.cancelled_at || undefined,
      cancellationReason: order.cancellation_reason || undefined,
      refundNeeded: Boolean(order.refund_needed),
      refundAmount: Number(order.refund_amount || 0),
      returnStatus: order.return_status || "none",
      returnReason: order.return_reason || undefined,
      returnNotes: order.return_notes || undefined
    };

    return res.json(safeOrder);
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/track (and /api/track-order)
router.post("/track", trackingLimiter, async (req, res, next) => {
  try {
    const orderNumber = String(req.body?.orderNumber || "").trim().toUpperCase();
    const rawPhone = String(req.body?.phone || "").replace(/\D/g, "");

    const GENERIC_NOT_FOUND = "We couldn't find an order with those details.";
    if (!orderNumber || !orderNumber.startsWith("SAR-") || rawPhone.length < 10) {
      return res.status(404).json({ error: GENERIC_NOT_FOUND });
    }

    const last10Phone = rawPhone.slice(-10);

    const [rows] = await pool.execute(
      `SELECT id, order_number, customer_phone, shipping_address, order_status,
              payment_method, payment_status, subtotal, shipping_fee, total,
              razorpay_payment_id, created_at, shipped_at, delivered_at,
              estimated_delivery, courier_name, tracking_number, tracking_url
       FROM orders
       WHERE order_number = ?
       LIMIT 1`,
      [orderNumber]
    );

    if (!rows.length) {
      return res.status(404).json({ error: GENERIC_NOT_FOUND });
    }

    const order = rows[0];
    const cleanCustomerPhone = String(order.customer_phone || "").replace(/\D/g, "").slice(-10);

    let parsedAddress = {};
    let cleanShippingPhone = "";
    try {
      parsedAddress = typeof order.shipping_address === "string" ? JSON.parse(order.shipping_address) : (order.shipping_address || {});
      cleanShippingPhone = String(parsedAddress.phone || "").replace(/\D/g, "").slice(-10);
    } catch {}

    const phoneMatches = (cleanCustomerPhone === last10Phone) || (cleanShippingPhone === last10Phone);
    if (!phoneMatches) {
      return res.status(404).json({ error: GENERIC_NOT_FOUND });
    }

    const [items] = await pool.execute(
      `SELECT product_name, quantity, image, unit_price
       FROM order_items
       WHERE order_id = ?`,
      [order.id]
    );

    const itemCount = items.reduce((sum, itm) => sum + Number(itm.quantity || 0), 0);
    const lines = items.map(itm => ({
      name: itm.product_name,
      quantity: Number(itm.quantity),
      image: itm.image || "",
      unitPrice: Number(itm.unit_price || 0)
    }));

    return res.json({
      orderNumber: order.order_number,
      orderStatus: order.order_status,
      paymentMethod: order.payment_method || "online",
      paymentStatus: order.payment_status || "pending",
      subtotal: Number(order.subtotal || 0),
      shippingFee: Number(order.shipping_fee || 0),
      couponCode: order.coupon_code || undefined,
      discountAmount: Number(order.discount_amount || 0),
      total: Number(order.total || 0),
      razorpayPaymentId: order.payment_status === "paid" ? (order.razorpay_payment_id || undefined) : undefined,
      shippingAddress: {
        city: parsedAddress.city || "",
        state: parsedAddress.state || "",
        pincode: parsedAddress.pincode || ""
      },
      createdAt: order.created_at,
      shippedAt: order.shipped_at || undefined,
      deliveredAt: order.delivered_at || undefined,
      estimatedDelivery: order.estimated_delivery || undefined,
      courierName: order.courier_name || undefined,
      trackingNumber: order.tracking_number || undefined,
      trackingUrl: order.tracking_url || undefined,
      itemCount,
      lines,
      items: lines
    });
  } catch (error) {
    next(error);
  }
});


// POST /api/orders/returns — customer-initiated return/exchange request.
// Authenticates using the order number plus the checkout mobile number, then
// enforces delivered status and the 7-day return window before inserting a request.
router.post("/returns", trackingLimiter, async (req, res, next) => {
  let connection;
  try {
    const orderNumber = String(req.body?.orderNumber || "").trim().toUpperCase();
    const phone = String(req.body?.phone || "").replace(/\\D/g, "");
    const requestType = String(req.body?.requestType || "").trim().toLowerCase();
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";

    if (!/^SAR-\\d{6}$/.test(orderNumber) || phone.length < 10) {
      return res.status(404).json({ error: "We couldn't verify this order. Check the order number and checkout mobile number." });
    }
    if (!["return", "exchange"].includes(requestType)) {
      return res.status(400).json({ error: "Choose return or exchange." });
    }
    if (reason.length < 3 || reason.length > 500) {
      return res.status(400).json({ error: "Please provide a reason between 3 and 500 characters." });
    }
    if (notes.length > 2000) {
      return res.status(400).json({ error: "Additional notes must be 2,000 characters or fewer." });
    }

    const last10Phone = phone.slice(-10);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [orders] = await connection.execute(
      "SELECT id, customer_phone, shipping_address, order_status, delivered_at FROM orders WHERE order_number = ? FOR UPDATE",
      [orderNumber]
    );
    if (!orders.length) {
      await connection.rollback();
      return res.status(404).json({ error: "We couldn't verify this order. Check the order number and checkout mobile number." });
    }

    const order = orders[0];
    let shippingPhone = "";
    try {
      const address = typeof order.shipping_address === "string" ? JSON.parse(order.shipping_address) : (order.shipping_address || {});
      shippingPhone = String(address.phone || "").replace(/\\D/g, "").slice(-10);
    } catch {}
    const customerPhone = String(order.customer_phone || "").replace(/\\D/g, "").slice(-10);
    if (customerPhone !== last10Phone && shippingPhone !== last10Phone) {
      await connection.rollback();
      return res.status(404).json({ error: "We couldn't verify this order. Check the order number and checkout mobile number." });
    }
    if (order.order_status !== "delivered" || !order.delivered_at) {
      await connection.rollback();
      return res.status(400).json({ error: "Return or exchange requests can only be submitted after delivery." });
    }
    const [windowRows] = await connection.execute(
      "SELECT (UTC_TIMESTAMP(3) <= DATE_ADD(?, INTERVAL 7 DAY)) AS within_window",
      [order.delivered_at]
    );
    if (!Number(windowRows[0]?.within_window)) {
      await connection.rollback();
      return res.status(400).json({ error: "The 7-day return request window has ended for this order." });
    }

    const [existing] = await connection.execute(
      "SELECT id FROM returns WHERE order_id = ? AND status NOT IN ('rejected', 'closed') LIMIT 1 FOR UPDATE",
      [order.id]
    );
    if (existing.length) {
      await connection.rollback();
      return res.status(409).json({ error: "A return or exchange request is already open for this order." });
    }

    const [insertResult] = await connection.execute(
      "INSERT INTO returns (order_id, request_type, reason, notes, status, created_at) VALUES (?, ?, ?, ?, 'pending', UTC_TIMESTAMP(3))",
      [order.id, requestType, reason, notes || null]
    );
    await connection.commit();
    return res.status(201).json({ success: true, requestId: Number(insertResult.insertId), orderNumber, status: "pending" });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection?.release();
  }
});

export default router;