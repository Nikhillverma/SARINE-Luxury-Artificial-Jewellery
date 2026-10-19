/**
 * Netlify Function: create-order
 *
 * Validates cart items, verifies active status, and takes prices strictly from Firestore.
 * Computes subtotal, shipping, and total on the server.
 * Generates sequential orderNumber and a cryptographic 32-byte publicToken.
 * Initializes a Razorpay order for online payment or decrements stock for COD.
 */

import { Handler } from '@netlify/functions';
import crypto from 'crypto';
import { getFirebaseAdmin, Transaction } from './utils/firebaseAdmin';
import { getRazorpay } from './utils/razorpay';
import { COD_ENABLED, calculateShippingFee } from './utils/storeConfig';
import { jsonResponse, errorResponse } from './utils/security';

interface CreateOrderRequestBody {
  items: Array<{ productId: string; quantity: number }>;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  shippingAddress: {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  paymentMethod: 'online' | 'cod';
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(204, {});
  }

  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  try {
    if (!event.body) {
      return errorResponse(400, 'Request body is empty');
    }

    let payload: CreateOrderRequestBody;
    try {
      payload = JSON.parse(event.body);
    } catch {
      return errorResponse(400, 'Invalid JSON body');
    }

    const { items, customer, shippingAddress, paymentMethod } = payload;

    // 1. Validate customer contact details
    if (!customer?.name || customer.name.trim().length < 2) {
      return errorResponse(400, 'Please enter a valid customer name.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!customer.email || !emailRegex.test(customer.email.trim())) {
      return errorResponse(400, 'Please enter a valid email address.');
    }

    const cleanCustomerPhone = (customer.phone || '').replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanCustomerPhone)) {
      return errorResponse(400, 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
    }

    // 2. Validate shipping address
    if (!shippingAddress?.fullName || shippingAddress.fullName.trim().length < 2) {
      return errorResponse(400, 'Please enter a recipient full name.');
    }

    const cleanShippingPhone = (shippingAddress.phone || '').replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanShippingPhone)) {
      return errorResponse(400, 'Please enter a valid recipient 10-digit mobile number.');
    }

    if (!shippingAddress.line1 || shippingAddress.line1.trim().length < 3) {
      return errorResponse(400, 'Please enter street address / house details.');
    }

    if (!shippingAddress.city || shippingAddress.city.trim().length < 2) {
      return errorResponse(400, 'Please enter delivery city.');
    }

    if (!shippingAddress.state || shippingAddress.state.trim().length < 2) {
      return errorResponse(400, 'Please select your state.');
    }

    const cleanPincode = (shippingAddress.pincode || '').trim();
    if (!/^[1-9][0-9]{5}$/.test(cleanPincode)) {
      return errorResponse(400, 'Please enter a valid 6-digit postal PIN code.');
    }

    // 3. Validate payment method
    if (paymentMethod !== 'online' && paymentMethod !== 'cod') {
      return errorResponse(400, 'Invalid payment method.');
    }

    if (paymentMethod === 'cod' && !COD_ENABLED) {
      return errorResponse(400, 'Cash on Delivery is currently unavailable. Please choose online payment.');
    }

    // 4. Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse(400, 'Your shopping bag is empty.');
    }

    for (const itm of items) {
      if (!itm.productId || typeof itm.productId !== 'string') {
        return errorResponse(400, 'Invalid product in order list.');
      }
      if (!Number.isInteger(itm.quantity) || itm.quantity <= 0) {
        return errorResponse(400, 'Product quantity must be a positive integer.');
      }
    }

    // 5. Connect to Firestore via Firebase Admin SDK
    const { db } = getFirebaseAdmin();

    // 6. Fetch live products from Firestore to authoritative verify price, status, and stock
    const verifiedLines: Array<{
      productId: string;
      name: string;
      unitPrice: number;
      quantity: number;
      image: string;
    }> = [];

    let calculatedSubtotal = 0;

    for (const itm of items) {
      const productDoc = await db.collection('products').doc(itm.productId).get();
      if (!productDoc.exists) {
        return errorResponse(400, 'One or more items in your bag could not be found.');
      }

      const productData = productDoc.data()!;

      if (productData.status !== 'active') {
        return errorResponse(
          400,
          `"${productData.name || 'Selected item'}" is no longer active in our collection.`
        );
      }

      const availableStock = typeof productData.stock === 'number' ? productData.stock : 0;
      if (availableStock <= 0) {
        return errorResponse(
          400,
          `"${productData.name}" is currently out of stock.`
        );
      }

      if (itm.quantity > availableStock) {
        return errorResponse(
          400,
          `Only ${availableStock} ${availableStock === 1 ? 'piece is' : 'pieces are'} available for "${productData.name}".`
        );
      }

      const unitPrice = Math.round(Number(productData.price) || 0);
      calculatedSubtotal += unitPrice * itm.quantity;

      verifiedLines.push({
        productId: productDoc.id,
        name: String(productData.name || 'Jewellery Piece'),
        unitPrice,
        quantity: itm.quantity,
        image: Array.isArray(productData.images) && productData.images[0] ? String(productData.images[0]) : ''
      });
    }

    // 7. Calculate shipping and total on the server
    const shippingFee = calculateShippingFee(calculatedSubtotal);
    const total = calculatedSubtotal + shippingFee;

    // 8. Generate sequential orderNumber inside a Firestore transaction
    const orderNumber = await db.runTransaction(async (t: Transaction) => {
      const counterRef = db.collection('_counters').doc('orders');
      const counterDoc = await t.get(counterRef);

      let nextSeq = 101;
      if (counterDoc.exists) {
        const val = counterDoc.data()?.seq;
        if (typeof val === 'number' && val >= 100) {
          nextSeq = val + 1;
        }
      }

      t.set(counterRef, { seq: nextSeq, updatedAt: new Date().toISOString() }, { merge: true });
      return `SAR-${nextSeq.toString().padStart(6, '0')}`;
    });

    // 9. Generate random 32-byte cryptographically secure publicToken
    const publicToken = crypto.randomBytes(32).toString('hex');

    // 10. Handle payment flow
    if (paymentMethod === 'online') {
      const razorpay = getRazorpay();
      const amountInPaise = Math.round(total * 100);

      const rpOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: orderNumber,
        notes: {
          orderNumber,
          customerName: customer.name.trim().slice(0, 40)
        }
      });

      // Save order snapshot in 'orders' collection
      const orderRecord = {
        id: orderNumber,
        orderNumber,
        publicToken,
        razorpayOrderId: rpOrder.id,
        lines: verifiedLines,
        customer: {
          name: customer.name.trim(),
          email: customer.email.trim().toLowerCase(),
          phone: cleanCustomerPhone
        },
        shippingAddress: {
          fullName: shippingAddress.fullName.trim(),
          phone: cleanShippingPhone,
          line1: shippingAddress.line1.trim(),
          line2: (shippingAddress.line2 || '').trim(),
          city: shippingAddress.city.trim(),
          state: shippingAddress.state.trim(),
          pincode: cleanPincode
        },
        subtotal: calculatedSubtotal,
        shippingFee,
        total,
        paymentMethod: 'online',
        paymentStatus: 'pending',
        orderStatus: 'awaiting_payment',
        createdAt: new Date().toISOString()
      };

      await db.collection('orders').doc(orderNumber).set(orderRecord);

      return jsonResponse(200, {
        orderNumber,
        publicToken,
        razorpayOrderId: rpOrder.id,
        amount: amountInPaise,
        keyId: process.env.RAZORPAY_KEY_ID
      });
    } else {
      // COD flow: decrement stock inside a Firestore transaction
      await db.runTransaction(async (t: Transaction) => {
        // Re-read stock in transaction
        for (const line of verifiedLines) {
          const pRef = db.collection('products').doc(line.productId);
          const pDoc = await t.get(pRef);
          if (!pDoc.exists) {
            throw new Error(`Product ${line.name} could not be located.`);
          }
          const currentStock = pDoc.data()?.stock || 0;
          if (currentStock < line.quantity) {
            throw new Error(`Insufficient stock for "${line.name}".`);
          }
          t.update(pRef, { stock: currentStock - line.quantity });
        }

        const orderRecord = {
          id: orderNumber,
          orderNumber,
          publicToken,
          lines: verifiedLines,
          customer: {
            name: customer.name.trim(),
            email: customer.email.trim().toLowerCase(),
            phone: cleanCustomerPhone
          },
          shippingAddress: {
            fullName: shippingAddress.fullName.trim(),
            phone: cleanShippingPhone,
            line1: shippingAddress.line1.trim(),
            line2: (shippingAddress.line2 || '').trim(),
            city: shippingAddress.city.trim(),
            state: shippingAddress.state.trim(),
            pincode: cleanPincode
          },
          subtotal: calculatedSubtotal,
          shippingFee,
          total,
          paymentMethod: 'cod',
          paymentStatus: 'pending',
          orderStatus: 'placed',
          createdAt: new Date().toISOString()
        };

        const orderRef = db.collection('orders').doc(orderNumber);
        t.set(orderRef, orderRecord);
      });

      return jsonResponse(200, {
        orderNumber,
        publicToken,
        orderStatus: 'placed',
        total
      });
    }
  } catch (err: any) {
    return errorResponse(
      500,
      err.message || 'An unexpected server error occurred while creating your order.',
      err.stack
    );
  }
};
