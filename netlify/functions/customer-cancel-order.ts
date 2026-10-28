/**
 * Netlify Function: customer-cancel-order
 *
 * Allows an authenticated customer to request cancellation of an eligible order
 * (prior to dispatch/shipping). Atomically restores stock inside a Firestore transaction.
 */

import { Handler } from '@netlify/functions';
import { getFirebaseAdmin, Transaction } from './utils/firebaseAdmin';
import { jsonResponse, errorResponse, handlePreflight } from './utils/security';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return handlePreflight(event);
  }

  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  // 1. Verify Authentication
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(401, 'Please sign in to manage your order.');
  }

  const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const { auth, db } = getFirebaseAdmin();
  let customerEmail = '';
  let customerUid = '';

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    customerEmail = (decodedToken.email || '').trim().toLowerCase();
    customerUid = decodedToken.uid || '';
  } catch (authErr) {
    return errorResponse(401, 'Your session has expired. Please sign in again.');
  }

  try {
    let body: any = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch {
        return errorResponse(400, 'Invalid request body.');
      }
    }

    const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim().toUpperCase() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : 'Customer requested cancellation';

    if (!orderNumber || !/^SAR-\d{6}$/.test(orderNumber)) {
      return errorResponse(400, 'Invalid order number reference.');
    }

    const orderRef = db.collection('orders').doc(orderNumber);

    await db.runTransaction(async (t: Transaction) => {
      const orderDoc = await t.get(orderRef);
      if (!orderDoc.exists) {
        throw new Error('ORDER_NOT_FOUND');
      }

      const orderData = orderDoc.data() || {};
      const orderOwnerEmail = (orderData.customer?.email || '').toLowerCase();
      const orderOwnerUid = orderData.customer?.userId || '';

      // Verify customer ownership
      const isOwner =
        (customerEmail && orderOwnerEmail === customerEmail) ||
        (customerUid && orderOwnerUid === customerUid);

      if (!isOwner) {
        throw new Error('FORBIDDEN');
      }

      // Check cancellation eligibility
      const eligibleStatuses = ['placed', 'pending', 'confirmed', 'awaiting_payment'];
      if (!eligibleStatuses.includes(orderData.orderStatus)) {
        if (orderData.orderStatus === 'shipped' || orderData.orderStatus === 'out_for_delivery') {
          throw new Error('ALREADY_SHIPPED');
        }
        if (orderData.orderStatus === 'delivered') {
          throw new Error('ALREADY_DELIVERED');
        }
        if (orderData.orderStatus === 'cancelled') {
          throw new Error('ALREADY_CANCELLED');
        }
        throw new Error('INELIGIBLE_STATUS');
      }

      // Restore product stock if order decremented inventory (COD or paid/confirmed online)
      if (Array.isArray(orderData.lines)) {
        for (const line of orderData.lines) {
          if (line.productId && line.quantity) {
            const productRef = db.collection('products').doc(line.productId);
            const productDoc = await t.get(productRef);
            if (productDoc.exists) {
              const currentStock = productDoc.data()?.stock || 0;
              t.update(productRef, { stock: currentStock + Number(line.quantity) });
            }
          }
        }
      }

      const updates: Record<string, any> = {
        orderStatus: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancellationReason: reason,
        updatedAt: new Date().toISOString()
      };

      // If customer already paid online, flag for refund
      if (orderData.paymentStatus === 'paid') {
        updates.refundNeeded = true;
        updates.refundAmount = orderData.total || 0;
      }

      t.update(orderRef, updates);
    });

    return jsonResponse(200, {
      success: true,
      message: 'Order cancelled successfully. Inventory has been updated.',
      orderNumber
    });
  } catch (err: any) {
    if (err.message === 'ORDER_NOT_FOUND' || err.message === 'FORBIDDEN') {
      return errorResponse(404, "We couldn't locate this order in your account.");
    }
    if (err.message === 'ALREADY_SHIPPED') {
      return errorResponse(400, 'This order has already shipped and cannot be cancelled directly. Please initiate a return upon delivery.');
    }
    if (err.message === 'ALREADY_DELIVERED') {
      return errorResponse(400, 'This order has already been delivered. You can request a return or exchange instead.');
    }
    if (err.message === 'ALREADY_CANCELLED') {
      return errorResponse(400, 'This order is already cancelled.');
    }
    console.error('[customer-cancel-order] Error:', err);
    return errorResponse(500, 'Unable to cancel order at this time. Please contact customer support.');
  }
};
