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

const RAZORPAY_PAYMENT_ID_REGEX = /^pay_[A-Za-z0-9]+$/;

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

      if (!rpOrderId || typeof rpOrderId !== 'string') {
        console.warn('[Razorpay Webhook] Ignored event: missing payment.order_id');
        return jsonResponse(200, { status: 'ignored_no_order_id' });
      }

      // Require payment.id matching /^pay_/
      if (
        !rpPaymentId ||
        typeof rpPaymentId !== 'string' ||
        !RAZORPAY_PAYMENT_ID_REGEX.test(rpPaymentId)
      ) {
        console.warn(`[Razorpay Webhook] Ignored event: invalid payment.id format: ${rpPaymentId}`);
        return jsonResponse(200, { status: 'ignored_invalid_payment_id' });
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

      // Require payment.amount === Math.round(order.total * 100) and currency 'INR' against the stored order; otherwise ignore it and log.
      const expectedAmountPaise = Math.round(Number(orderData.total || 0) * 100);
      if (payment.amount !== expectedAmountPaise || payment.currency !== 'INR') {
        console.warn(
          `[Razorpay Webhook] Amount or currency mismatch for order ${orderData.orderNumber}: expected ${expectedAmountPaise} INR, received ${payment.amount} ${payment.currency}`
        );
        return jsonResponse(200, { status: 'ignored_amount_currency_mismatch' });
      }

      // Execute transaction with idempotent logic (remove every `|| ''` fallback)
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
            razorpayPaymentId: rpPaymentId,
            paidAt: nowIso,
            webhookCaptured: true,
            updatedAt: nowIso
          });
        } else {
          transaction.update(orderRef!, {
            paymentStatus: 'paid',
            orderStatus: 'needs_refund',
            razorpayPaymentId: rpPaymentId,
            paidAt: nowIso,
            refundReason: 'Stock exhausted prior to payment completion.',
            webhookCaptured: true,
            updatedAt: nowIso
          });
        }
      });

      return jsonResponse(200, { status: 'ok' });
    }

    // Add payment.failed: find the order by razorpayOrderId and set paymentStatus 'failed' and orderStatus 'failed' ONLY if the order is currently 'pending'. Never downgrade a 'paid' order.
    if (eventName === 'payment.failed') {
      const payment = payload.payload?.payment?.entity;
      const rpOrderId = payment?.order_id;

      if (!rpOrderId || typeof rpOrderId !== 'string') {
        console.warn('[Razorpay Webhook] payment.failed event missing order_id');
        return jsonResponse(200, { status: 'ignored_no_order_id' });
      }

      const { db } = getFirebaseAdmin();
      let orderDoc = null;

      const querySnapshot = await db
        .collection('orders')
        .where('razorpayOrderId', '==', rpOrderId)
        .limit(1)
        .get();

      if (!querySnapshot.empty) {
        orderDoc = querySnapshot.docs[0];
      } else if (payment?.notes?.orderNumber) {
        const directDoc = await db.collection('orders').doc(payment.notes.orderNumber).get();
        if (directDoc.exists) {
          orderDoc = directDoc;
        }
      }

      if (!orderDoc || !orderDoc.exists) {
        console.warn(`[Razorpay Webhook] payment.failed: Order not found for Razorpay order ID ${rpOrderId}`);
        return jsonResponse(200, { status: 'order_not_found' });
      }

      const orderData = orderDoc.data();
      // Set paymentStatus 'failed' and orderStatus 'failed' ONLY if the order is currently 'pending'. Never downgrade a 'paid' order.
      if (orderData && orderData.paymentStatus === 'pending') {
        await orderDoc.ref.update({
          paymentStatus: 'failed',
          orderStatus: 'failed',
          updatedAt: new Date().toISOString(),
          failureReason: payment?.error_description || 'Payment failed on gateway.'
        });
        console.log(`[Razorpay Webhook] Set order ${orderDoc.id} status to failed due to payment.failed event.`);
      } else {
        console.log(
          `[Razorpay Webhook] Ignored payment.failed for order ${orderDoc.id}: paymentStatus is '${orderData?.paymentStatus}' (not pending)`
        );
      }

      return jsonResponse(200, { status: 'ok' });
    }

    return jsonResponse(200, { status: 'ignored_event' });
  } catch (err: any) {
    return errorResponse(
      500,
      'Internal error processing webhook',
      err.stack
    );
  }
};
