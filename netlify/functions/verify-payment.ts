/**
 * Netlify Function: verify-payment
 *
 * Verifies Razorpay HMAC-SHA256 signature and publicToken with timing-safe comparison.
 * Requires publicToken, verifies payment status via Razorpay API, and in a single Firestore transaction:
 * - Returns success idempotently if order was already marked paid (e.g. by webhook).
 * - Re-checks stock and decrements inventory if available.
 * - Sets paymentStatus 'paid' and orderStatus 'confirmed'.
 * - If stock ran out before payment finalized, sets orderStatus 'needs_refund'.
 */

import { Handler } from '@netlify/functions';
import crypto from 'crypto';
import { getFirebaseAdmin, Transaction } from './utils/firebaseAdmin';
import { getRazorpay } from './utils/razorpay';
import { timingSafeCompare, jsonResponse, errorResponse } from './utils/security';

interface VerifyPaymentBody {
  orderNumber?: string;
  publicToken?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
}

const RAZORPAY_PAYMENT_ID_REGEX = /^pay_[A-Za-z0-9]+$/;

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(204, {});
  }

  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  try {
    if (!event.body) {
      return errorResponse(400, 'Request body is required');
    }

    let payload: VerifyPaymentBody;
    try {
      payload = JSON.parse(event.body);
    } catch {
      return errorResponse(400, 'Invalid JSON body');
    }

    const {
      orderNumber,
      publicToken,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = payload;

    // publicToken is REQUIRED. Missing or wrong token: return 403 and change nothing.
    if (!publicToken || typeof publicToken !== 'string' || !publicToken.trim()) {
      return errorResponse(403, 'Unauthorized access to order verification.');
    }

    if (!orderNumber || typeof orderNumber !== 'string' || !orderNumber.trim()) {
      return errorResponse(400, 'Order number is required.');
    }

    const cleanOrderNumber = orderNumber.trim();
    const cleanPublicToken = publicToken.trim();

    const { db } = getFirebaseAdmin();
    const orderRef = db.collection('orders').doc(cleanOrderNumber);
    const initialDoc = await orderRef.get();

    if (!initialDoc.exists) {
      return errorResponse(404, 'We could not find the specified order.');
    }

    const initialData = initialDoc.data()!;

    // Validate publicToken against stored token with timing-safe comparison
    if (!timingSafeCompare(initialData.publicToken || '', cleanPublicToken)) {
      return errorResponse(403, 'Unauthorized access to order verification.');
    }

    if (initialData.paymentMethod !== 'online') {
      return errorResponse(400, 'This order does not require online payment.');
    }

    // Load the order first. If paymentStatus is already 'paid', return success immediately (idempotent) before any other check.
    if (initialData.paymentStatus === 'paid') {
      return jsonResponse(200, {
        success: true,
        orderNumber: initialData.orderNumber || cleanOrderNumber,
        paymentStatus: 'paid',
        orderStatus: initialData.orderStatus,
        alreadyProcessed: true
      });
    }

    // razorpay_payment_id must match /^pay_[A-Za-z0-9]+$/. Never write '' as a payment id anywhere.
    if (
      !razorpay_payment_id ||
      typeof razorpay_payment_id !== 'string' ||
      !RAZORPAY_PAYMENT_ID_REGEX.test(razorpay_payment_id)
    ) {
      return errorResponse(400, 'Invalid or missing Razorpay payment ID.');
    }

    if (!razorpay_order_id || typeof razorpay_order_id !== 'string' || !razorpay_order_id.trim()) {
      return errorResponse(400, 'Missing Razorpay order ID.');
    }

    if (!razorpay_signature || typeof razorpay_signature !== 'string' || !razorpay_signature.trim()) {
      return errorResponse(400, 'Missing Razorpay payment signature.');
    }

    // Verify digital signature using RAZORPAY_KEY_SECRET with timing-safe comparison
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return errorResponse(500, 'Payment verification is unconfigured on the server.');
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const isSignatureValid = timingSafeCompare(expectedSignature, razorpay_signature);
    const isOrderIdMatch = initialData.razorpayOrderId === razorpay_order_id;

    // Never overwrite an order that is 'paid'. Only set paymentStatus/orderStatus 'failed'
    // when the token is valid, the order is currently 'pending', and the signature or razorpay_order_id is wrong. Otherwise just return 400.
    if (!isSignatureValid || !isOrderIdMatch) {
      if (initialData.paymentStatus === 'pending') {
        try {
          await orderRef.update({
            paymentStatus: 'failed',
            orderStatus: 'failed',
            updatedAt: new Date().toISOString(),
            failureReason: !isSignatureValid
              ? 'Payment signature validation failed.'
              : 'Razorpay order identifier does not match this order.'
          });
        } catch (updateErr) {
          console.warn('[verify-payment] Could not mark order as failed in Firestore:', updateErr);
        }
      }

      if (!isSignatureValid) {
        return errorResponse(400, 'Payment signature validation failed.');
      } else {
        return errorResponse(400, 'Razorpay order identifier does not match this order.');
      }
    }

    // After the signature and order-id checks pass, call razorpay.payments.fetch(razorpay_payment_id).
    // Require payment.order_id === stored razorpayOrderId, payment.amount === Math.round(order.total * 100), payment.currency === 'INR'.
    const razorpay = getRazorpay();
    let paymentRecord: any;
    try {
      paymentRecord = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (fetchErr: any) {
      return errorResponse(500, 'Something went wrong. Please try again.', fetchErr);
    }

    if (!paymentRecord) {
      return errorResponse(400, 'Payment record was not returned by gateway.');
    }

    const expectedAmountPaise = Math.round(Number(initialData.total || 0) * 100);

    if (paymentRecord.order_id !== initialData.razorpayOrderId) {
      return errorResponse(400, 'Payment does not belong to this order.');
    }

    if (paymentRecord.amount !== expectedAmountPaise) {
      return errorResponse(400, 'Payment amount mismatch with order total.');
    }

    if (paymentRecord.currency !== 'INR') {
      return errorResponse(400, 'Payment currency must be INR.');
    }

    // If payment.status is 'authorized' (not yet captured), do NOT mark paid; return { success: false, pending: true, message: 'Your payment is being confirmed.' }
    if (paymentRecord.status === 'authorized') {
      return jsonResponse(200, {
        success: false,
        pending: true,
        message: 'Your payment is being confirmed.'
      });
    }

    // If payment.status is 'captured', continue to the existing stock transaction and mark paid/confirmed. Any other status: return an error.
    if (paymentRecord.status !== 'captured') {
      return errorResponse(400, `Payment is in invalid status: ${paymentRecord.status}`);
    }

    // Execute in ONE Firestore transaction
    const result = await db.runTransaction(async (transaction: Transaction) => {
      const freshOrderDoc = await transaction.get(orderRef);
      if (!freshOrderDoc.exists) {
        throw new Error('Order was not found during transaction.');
      }

      const order = freshOrderDoc.data()!;

      // Idempotency: if order is already paid, return success immediately
      if (order.paymentStatus === 'paid') {
        return {
          success: true,
          orderNumber: cleanOrderNumber,
          paymentStatus: 'paid',
          orderStatus: order.orderStatus,
          alreadyProcessed: true
        };
      }

      // Read all products referenced in order lines inside the transaction
      const lines: Array<{ productId: string; quantity: number; name: string }> = order.lines || [];
      const productDocsWithRef = [];

      for (const line of lines) {
        const pRef = db.collection('products').doc(line.productId);
        const pDoc = await transaction.get(pRef);
        productDocsWithRef.push({ line, pRef, pDoc });
      }

      // Check whether every product has sufficient stock
      let hasSufficientStock = true;
      for (const { line, pDoc } of productDocsWithRef) {
        if (!pDoc.exists) {
          hasSufficientStock = false;
          break;
        }
        const currentStock = pDoc.data()?.stock || 0;
        if (currentStock < line.quantity) {
          hasSufficientStock = false;
          break;
        }
      }

      const nowIso = new Date().toISOString();

      if (hasSufficientStock) {
        // Decrement stock for all items
        for (const { line, pRef, pDoc } of productDocsWithRef) {
          const currentStock = pDoc.data()?.stock || 0;
          transaction.update(pRef, {
            stock: currentStock - line.quantity,
            updatedAt: nowIso
          });
        }

        // Mark order as paid and confirmed (never write '' as payment id; strictly valid razorpay_payment_id)
        transaction.update(orderRef, {
          paymentStatus: 'paid',
          orderStatus: 'confirmed',
          razorpayPaymentId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
          razorpaySignature: razorpay_signature,
          paidAt: nowIso,
          updatedAt: nowIso
        });

        return {
          success: true,
          orderNumber: cleanOrderNumber,
          paymentStatus: 'paid',
          orderStatus: 'confirmed'
        };
      } else {
        // Stock is no longer sufficient; flag for refund
        transaction.update(orderRef, {
          paymentStatus: 'paid',
          orderStatus: 'needs_refund',
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          paidAt: nowIso,
          refundReason: 'Stock exhausted between order creation and payment authorization.',
          updatedAt: nowIso
        });

        return {
          success: false,
          needsRefund: true,
          orderNumber: cleanOrderNumber,
          orderStatus: 'needs_refund',
          message:
            'Payment was captured, but one or more pieces went out of stock before payment was finalized. Our team has flagged this order for an immediate full refund.'
        };
      }
    });

    return jsonResponse(200, result);
  } catch (err: any) {
    return errorResponse(
      500,
      'Something went wrong. Please try again.',
      err
    );
  }
};
