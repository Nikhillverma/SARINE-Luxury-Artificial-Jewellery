import { formatVariantLabel as defaultFormatVariantLabel } from "./productVariantPolicy.js";
import { sortStockItems as defaultSortStockItems } from "./stockLockPolicy.js";
import { classifyCapturedPayment as defaultClassifyCapturedPayment } from "./paymentValidation.js";

/**
 * Apply a captured Razorpay payment inside the caller's already-open transaction.
 * The caller must lock the order row with SELECT ... FOR UPDATE, validate its
 * public token when handling browser verification, and commit only after this
 * function returns successfully.
 */
export async function settleCapturedPayment(connection, {
  order,
  cleanOrderNumber,
  razorpay_order_id,
  razorpay_payment_id,
  paymentRecord
}, onResult = value => value, dependencies = {}) {
  const inventory = dependencies.recordInventoryMovement ? null : await import("./inventoryLedger.js");
  const variants = (dependencies.syncProductVariantStock && dependencies.recordVariantInventoryMovement)
    ? null : await import("./productVariantSchema.js");
  const payments = dependencies.recordVerifiedPaymentEvent ? null : await import("./paymentEventPolicy.js");
  const marketing = (dependencies.confirmCouponRedemption && dependencies.releaseCouponRedemptionForCancelledOrder)
    ? null : await import("./marketingPolicy.js");
  const writeInventoryMovement = dependencies.recordInventoryMovement || inventory.recordInventoryMovement;
  const syncVariantStock = dependencies.syncProductVariantStock || variants.syncProductVariantStock;
  const writeVariantInventoryMovement = dependencies.recordVariantInventoryMovement || variants.recordVariantInventoryMovement;
  const getVariantLabel = dependencies.formatVariantLabel || defaultFormatVariantLabel;
  const sortItems = dependencies.sortStockItems || defaultSortStockItems;
  const writePaymentEvent = dependencies.recordVerifiedPaymentEvent || payments.recordVerifiedPaymentEvent;
  const classifyPayment = dependencies.classifyCapturedPayment || defaultClassifyCapturedPayment;
  const confirmCoupon = dependencies.confirmCouponRedemption || marketing.confirmCouponRedemption;
  const releaseCoupon = dependencies.releaseCouponRedemptionForCancelledOrder || marketing.releaseCouponRedemptionForCancelledOrder;
    // Idempotent replay of the same captured payment is safe. A different
    // captured payment against an already-paid order is a second charge and
    // must be surfaced for refund review rather than silently accepted.
    if (order.payment_status === "paid") {
      const captureDisposition = classifyPayment(order, razorpay_payment_id);
      const samePayment = captureDisposition === "same_payment_replay";
      const paymentEvent = await writePaymentEvent(connection, {
        orderId: order.id,
        orderNumber: cleanOrderNumber,
        gatewayOrderId: razorpay_order_id,
        gatewayPaymentId: razorpay_payment_id,
        amountPaise: Number(paymentRecord.amount),
        currency: paymentRecord.currency,
        eventType: "payment_captured",
        eventStatus: samePayment ? "already_processed" : "additional_capture_refund_review"
      });

      // A replay of the same additional capture must not increase the refund
      // balance a second time.
      if (!samePayment && paymentEvent.inserted) {
        const additionalAmount = (Number(paymentRecord.amount) / 100).toFixed(2);
        await connection.execute(
          `UPDATE orders
           SET refund_needed = 1,
               refund_amount = COALESCE(refund_amount, 0) + ?,
               updated_at = UTC_TIMESTAMP(3)
           WHERE id = ?`,
          [additionalAmount, order.id]
        );
        await connection.execute(
          `INSERT INTO order_status_history (order_id, old_status, new_status, note, changed_by, created_at)
           VALUES (?, ?, ?, ?, 'system', UTC_TIMESTAMP(3))`,
          [order.id, order.order_status, order.order_status,
            `Additional captured payment ${razorpay_payment_id} requires manual refund review.`]
        );
      }

      return onResult(samePayment ? {
        success: true,
        orderNumber: cleanOrderNumber,
        paymentStatus: "paid",
        orderStatus: order.order_status,
        alreadyProcessed: true
      } : {
        success: false,
        needsRefund: true,
        additionalPaymentCaptured: true,
        orderNumber: cleanOrderNumber,
        orderStatus: order.order_status,
        message: "An additional payment was captured for an already-paid order. It has been flagged for manual refund review."
      });
    }

    // A gateway capture can race with an admin cancellation or a failed
    // gateway-order initialization. Never resurrect these terminal orders or
    // deduct inventory after cancellation; record the capture and route it to
    // the refund queue instead.
    if (order.order_status === "cancelled" || order.order_status === "failed") {
      const paymentEvent = await writePaymentEvent(connection, {
        orderId: order.id,
        orderNumber: cleanOrderNumber,
        gatewayOrderId: razorpay_order_id,
        gatewayPaymentId: razorpay_payment_id,
        amountPaise: Number(paymentRecord.amount),
        currency: paymentRecord.currency,
        eventType: "payment_captured",
        eventStatus: "late_capture_refund_review"
      });
      if (paymentEvent.inserted) {
        const capturedAmount = (Number(paymentRecord.amount) / 100).toFixed(2);
        await connection.execute(
          `UPDATE orders
           SET payment_status = 'paid',
               refund_needed = 1,
               refund_amount = COALESCE(refund_amount, 0) + ?,
               razorpay_payment_id = ?,
               updated_at = UTC_TIMESTAMP(3)
           WHERE id = ?`,
          [capturedAmount, razorpay_payment_id, order.id]
        );
      } else {
        await connection.execute(
          `UPDATE orders
           SET payment_status = 'paid',
               refund_needed = 1,
               razorpay_payment_id = ?,
               updated_at = UTC_TIMESTAMP(3)
           WHERE id = ?`,
          [razorpay_payment_id, order.id]
        );
      }
      await connection.execute(
        `INSERT INTO order_status_history (order_id, old_status, new_status, note, changed_by, created_at)
         VALUES (?, ?, ?, ?, 'system', UTC_TIMESTAMP(3))`,
        [order.id, order.order_status, order.order_status,
          `Payment ${razorpay_payment_id} was captured after the order was ${order.order_status}; manual refund review is required.`]
      );
      return onResult({
        success: false,
        needsRefund: true,
        lateCaptureAfterCancellation: true,
        orderNumber: cleanOrderNumber,
        orderStatus: order.order_status,
        message: "Payment was captured after this order was cancelled or failed. It has been flagged for manual refund review; inventory was not deducted."
      });
    }

    // Lock product items
    const [orderItems] = await connection.execute(
      `SELECT product_id, variant_id, variant_sku, variant_label, quantity, product_name
       FROM order_items WHERE order_id = ?`,
      [order.id]
    );

    const aggregatedItems = new Map();
    let hasSufficientStock = orderItems.length > 0;
    for (const item of orderItems) {
      if (!item.product_id) {
        hasSufficientStock = false;
        break;
      }
      const stockKey = item.variant_id ? `variant:${item.variant_id}` : `product:${item.product_id}`;
      const existing = aggregatedItems.get(stockKey);
      if (existing) {
        existing.quantity += Number(item.quantity);
      } else {
        aggregatedItems.set(stockKey, {
          productId: item.product_id,
          variantId: item.variant_id || null,
          variantSku: item.variant_sku || null,
          variantLabel: item.variant_label || "",
          productName: item.product_name || "Product",
          quantity: Number(item.quantity),
          previousStock: null
        });
      }
    }

    // Use the same deterministic parent-first lock order as checkout and cancellation.
    const stockItems = sortItems([...aggregatedItems.values()]);
    for (const item of stockItems) {
      const [products] = await connection.execute(
        `SELECT id, name, stock FROM products WHERE id = ? FOR UPDATE`,
        [item.productId]
      );
      if (!products.length) {
        hasSufficientStock = false;
        break;
      }
      const product = products[0];
      item.productName = product.name || item.productName;

      if (item.variantId) {
        const [variantRows] = await connection.execute(
          `SELECT id, product_id, sku, option1_name, option1_value, option2_name, option2_value, stock
           FROM product_variants
           WHERE id = ? AND product_id = ? FOR UPDATE`,
          [item.variantId, item.productId]
        );
        if (!variantRows.length || Number(variantRows[0].stock || 0) < item.quantity) {
          hasSufficientStock = false;
          break;
        }
        item.variantSku = variantRows[0].sku || item.variantSku;
        item.variantLabel = getVariantLabel(variantRows[0].option1_name, variantRows[0].option1_value, variantRows[0].option2_name, variantRows[0].option2_value) || item.variantLabel;
        item.previousStock = Number(variantRows[0].stock || 0);
      } else {
        if (Number(product.stock || 0) < item.quantity) {
          hasSufficientStock = false;
          break;
        }
        item.previousStock = Number(product.stock || 0);
      }
    }

    if (hasSufficientStock) {
      // Deduct each distinct product or variant once and record the movement atomically.
      for (const item of stockItems) {
        const newStock = item.previousStock - item.quantity;
        if (item.variantId) {
          await connection.execute(
            "UPDATE product_variants SET stock = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?",
            [newStock, item.variantId]
          );
          await syncVariantStock(connection, item.productId);
          await writeVariantInventoryMovement(connection, {
            variantId: item.variantId, productId: item.productId,
            productName: item.productName, variantSku: item.variantSku,
            variantLabel: item.variantLabel, previousStock: item.previousStock,
            quantityDelta: -item.quantity, newStock,
            reason: `Online payment captured ${cleanOrderNumber}`,
            adminName: "Razorpay payment", adminEmail: "system@sarine.local"
          });
        } else {
          await connection.execute(
            `UPDATE products SET stock = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?`,
            [newStock, item.productId]
          );
          await writeInventoryMovement(connection, {
            productId: item.productId, productName: item.productName,
            previousStock: item.previousStock, quantityDelta: -item.quantity,
            newStock, reason: `Online payment captured ${cleanOrderNumber}`,
            actorName: "Razorpay payment", actorEmail: "system@sarine.local"
          });
        }
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
      await confirmCoupon(connection, order.id);
      await writePaymentEvent(connection, {
        orderId: order.id,
        orderNumber: cleanOrderNumber,
        gatewayOrderId: razorpay_order_id,
        gatewayPaymentId: razorpay_payment_id,
        amountPaise: Number(paymentRecord.amount),
        currency: paymentRecord.currency,
        eventType: "payment_captured",
        eventStatus: "confirmed"
      });

      return onResult({
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
      await writePaymentEvent(connection, {
        orderId: order.id,
        orderNumber: cleanOrderNumber,
        gatewayOrderId: razorpay_order_id,
        gatewayPaymentId: razorpay_payment_id,
        amountPaise: Number(paymentRecord.amount),
        currency: paymentRecord.currency,
        eventType: "payment_captured",
        eventStatus: "stock_conflict_refund_required"
      });
      // A stock-conflict refund will not enter the normal cancellation action.
      // Release its coupon reservation in this same transaction.
      if (order.coupon_code) {
        await releaseCoupon(connection, order.id);
      }

      return onResult({
        success: false,
        needsRefund: true,
        orderNumber: cleanOrderNumber,
        orderStatus: "needs_refund",
        message:
          "Payment was captured, but one or more pieces went out of stock before payment was finalized. Our team has flagged this order for an immediate full refund."
      });
    }
}
