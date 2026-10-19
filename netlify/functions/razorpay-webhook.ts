/**
 * Netlify Function: razorpay-webhook
 *
 * Receives and validates Razorpay webhooks using RAZORPAY_WEBHOOK_SECRET.
 * Ensures orders are marked paid and stock is decremented idempotently,
 * even if the customer's browser window is closed during redirection.
 */

import { Handler } from '@netlify/functions';
import crypto from 'crypto';
import { getFirebaseAdmin, Transaction } from './utils/firebaseAdmin';
import { timingSafeCompare, jsonResponse, errorResponse } from './utils/security';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(204, {});
  }

  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  try {
    const signature =
      event.headers['x-razorpay-signature'] ||
      event.headers['X-Razorpay-Signature'];

    if (!signature) {
      return errorResponse(400, 'Missing webhook signature header');
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return errorResponse(500, 'Webhook secret not configured on the server');
    }

    // Decode base64 to exact original bytes if Netlify encoded it; never use JSON.parse + JSON.stringify
    const rawBuffer: Buffer =
      event.isBase64Encoded && event.body
        ? Buffer.from(event.body, 'base64')
        : Buffer.from(event.body || '', 'utf8');

    // Verify webhook signature with timing-safe comparison against exact raw body bytes
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBuffer)
      .digest('hex');

    if (!timingSafeCompare(expectedSignature, signature)) {
      return errorResponse(400, 'Invalid webhook signature');
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBuffer.toString('utf8'));
    } catch {
      return errorResponse(400, 'Malformed webhook payload');
    }

    const eventName = payload.event;

    // Handle payment capture or order payment event
    if (eventName === 'payment.captured' || eventName === 'order.paid') {
      const payment = payload.payload?.payment?.entity;
      const rpOrderId = payment?.order_id;
      const rpPaymentId = payment?.id;

      if (!rpOrderId) {
        return jsonResponse(200, { status: 'ignored_no_order_id' });
      }

      const { db } = getFirebaseAdmin();

      // Find order by razorpayOrderId or note orderNumber
      let orderRef = null;
      let orderDoc = null;

      const querySnapshot = await db
        .collection('orders')
        .where('razorpayOrderId', '==', rpOrderId)
        .limit(1)
        .get();

      if (!querySnapshot.empty) {
        orderDoc = querySnapshot.docs[0];
        orderRef = orderDoc.ref;
      } else if (payment?.notes?.orderNumber) {
        const directDoc = await db.collection('orders').doc(payment.notes.orderNumber).get();
        if (directDoc.exists) {
          orderDoc = directDoc;
          orderRef = directDoc.ref;
        }
      }

      // Check that the order exists
      if (!orderRef || !orderDoc || !orderDoc.exists) {
        console.warn(`[Razorpay Webhook] Order does not exist for Razorpay order ID: ${rpOrderId}`);
        return jsonResponse(200, { status: 'order_not_found_locally' });
      }

      // Check that the Razorpay order ID matches the one stored on that order
      const orderData = orderDoc.data();
      if (!orderData || orderData.razorpayOrderId !== rpOrderId) {
        console.warn(
          `[Razorpay Webhook] Razorpay order ID mismatch: expected ${orderData?.razorpayOrderId}, received ${rpOrderId}`
        );
        return jsonResponse(200, { status: 'razorpay_order_id_mismatch' });
      }

      // Execute transaction with the same idempotent logic
      await db.runTransaction(async (transaction: Transaction) => {
        const freshDoc = await transaction.get(orderRef!);
        if (!freshDoc.exists) {
          console.warn('[Razorpay Webhook] Order does not exist during transaction.');
          return;
        }

        const order = freshDoc.data()!;

        // Double check in transaction that stored razorpayOrderId matches incoming rpOrderId
        if (order.razorpayOrderId !== rpOrderId) {
          console.warn(
            `[Razorpay Webhook] Razorpay order ID mismatch in transaction. Stored: ${order.razorpayOrderId}, incoming: ${rpOrderId}`
          );
          return;
        }

        // Idempotency: skip if already paid
        if (order.paymentStatus === 'paid') {
          return;
        }

        const lines: Array<{ productId: string; quantity: number; name: string }> = order.lines || [];
        const productDocsWithRef = [];

        for (const line of lines) {
          const pRef = db.collection('products').doc(line.productId);
          const pDoc = await transaction.get(pRef);
          productDocsWithRef.push({ line, pRef, pDoc });
        }

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
          for (const { line, pRef, pDoc } of productDocsWithRef) {
            const currentStock = pDoc.data()?.stock || 0;
            transaction.update(pRef, {
              stock: currentStock - line.quantity,
              updatedAt: nowIso
            });
          }

          transaction.update(orderRef!, {
            paymentStatus: 'paid',
            orderStatus: 'confirmed',
            razorpayPaymentId: rpPaymentId || order.razorpayPaymentId || '',
            paidAt: nowIso,
            webhookCaptured: true,
            updatedAt: nowIso
          });
        } else {
          transaction.update(orderRef!, {
            paymentStatus: 'paid',
            orderStatus: 'needs_refund',
            razorpayPaymentId: rpPaymentId || order.razorpayPaymentId || '',
            paidAt: nowIso,
            refundReason: 'Stock exhausted prior to payment completion.',
            webhookCaptured: true,
            updatedAt: nowIso
          });
        }
      });
    }

    return jsonResponse(200, { status: 'ok' });
  } catch (err: any) {
    return errorResponse(
      500,
      'Internal error processing webhook',
      err.stack
    );
  }
};
