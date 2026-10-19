/**
 * Netlify Function: verify-payment
 *
 * Verifies Razorpay HMAC-SHA256 signature and publicToken with timing-safe comparison.
 * In a single Firestore transaction:
 * - Returns success idempotently if order was already marked paid (e.g. by webhook).
 * - Re-checks stock and decrements inventory if available.
 * - Sets paymentStatus 'paid' and orderStatus 'confirmed'.
 * - If stock ran out before payment finalized, sets orderStatus 'needs_refund'.
 */

import { Handler } from '@netlify/functions';
import crypto from 'crypto';
import { getFirebaseAdmin, Transaction } from './utils/firebaseAdmin';
import { timingSafeCompare, jsonResponse, errorResponse } from './utils/security';

interface VerifyPaymentBody {
  orderNumber: string;
  publicToken: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
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

    if (
      !orderNumber ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return errorResponse(400, 'Missing required payment verification parameters.');
    }

    const { db } = getFirebaseAdmin();
    const orderRef = db.collection('orders').doc(orderNumber);
    const initialDoc = await orderRef.get();

    if (!initialDoc.exists) {
      return errorResponse(404, 'We could not find the specified order.');
    }

    const initialData = initialDoc.data()!;

    // If publicToken is provided, verify it
    if (publicToken && !timingSafeCompare(initialData.publicToken || '', publicToken)) {
      return errorResponse(403, 'Unauthorized access to order verification.');
    }

    // 1. Verify digital signature using RAZORPAY_KEY_SECRET with timing-safe check
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

    // If invalid, set paymentStatus 'failed' and return an error
    if (!isSignatureValid || !isOrderIdMatch) {
      try {
        await orderRef.update({
          paymentStatus: 'failed',
          orderStatus: 'failed',
          updatedAt: new Date().toISOString(),
          failureReason: !isSignatureValid
            ? 'Payment signature validation failed.'
            : 'Razorpay order identifier does not match this order.'
        });
      } catch (err) {
        console.warn('[verify-payment] Could not mark order as failed in Firestore:', err);
      }

      if (!isSignatureValid) {
        return errorResponse(400, 'Payment signature validation failed.');
      } else {
        return errorResponse(400, 'Razorpay order identifier does not match this order.');
      }
    }

    // 3. Execute in ONE Firestore transaction
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
          orderNumber,
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

        // Mark order as paid and confirmed
        transaction.update(orderRef, {
          paymentStatus: 'paid',
          orderStatus: 'confirmed',
          razorpayPaymentId: razorpay_payment_id || '',
          razorpayOrderId: razorpay_order_id,
          razorpaySignature: razorpay_signature || '',
          paidAt: nowIso,
          updatedAt: nowIso
        });

        return {
          success: true,
          orderNumber,
          paymentStatus: 'paid',
          orderStatus: 'confirmed'
        };
      } else {
        // Stock is no longer sufficient; flag for refund
        transaction.update(orderRef, {
          paymentStatus: 'paid',
          orderStatus: 'needs_refund',
          razorpayPaymentId: razorpay_payment_id || '',
          razorpaySignature: razorpay_signature || '',
          paidAt: nowIso,
          refundReason: 'Stock exhausted between order creation and payment authorization.',
          updatedAt: nowIso
        });

        return {
          success: false,
          needsRefund: true,
          orderNumber,
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
      err.message || 'An error occurred while verifying your payment.',
      err.stack
    );
  }
};
