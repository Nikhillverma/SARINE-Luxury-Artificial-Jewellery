/**
 * Netlify Function: customer-return-request
 *
 * Allows an authenticated customer to request a return or exchange for an eligible delivered order.
 */

import { Handler } from '@netlify/functions';
import { getFirebaseAdmin } from './utils/firebaseAdmin';
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
    return errorResponse(401, 'Please sign in to request a return or exchange.');
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
    const reason = typeof body.reason === 'string' ? body.reason.trim() : 'Defect or size adjustment';
    const actionType = body.actionType === 'exchange' ? 'exchange' : 'return';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

    if (!orderNumber || !/^SAR-\d{6}$/.test(orderNumber)) {
      return errorResponse(400, 'Invalid order number reference.');
    }

    const orderDoc = await db.collection('orders').doc(orderNumber).get();
    if (!orderDoc.exists) {
      return errorResponse(404, "We couldn't locate this order in your account.");
    }

    const orderData = orderDoc.data() || {};
    const orderOwnerEmail = (orderData.customer?.email || '').toLowerCase();
    const orderOwnerUid = orderData.customer?.userId || '';

    // Verify ownership
    const isOwner =
      (customerEmail && orderOwnerEmail === customerEmail) ||
      (customerUid && orderOwnerUid === customerUid);

    if (!isOwner) {
      return errorResponse(404, "We couldn't locate this order in your account.");
    }

    // Must be delivered to be eligible for return/exchange
    if (orderData.orderStatus !== 'delivered') {
      return errorResponse(
        400,
        'Returns and exchanges can only be initiated for orders that have been successfully delivered.'
      );
    }

    // Check if return was already requested
    if (orderData.returnStatus && orderData.returnStatus !== 'none') {
      return errorResponse(
        400,
        `A ${orderData.returnStatus.replace('_', ' ')} has already been recorded for this order.`
      );
    }

    const returnStatus = actionType === 'exchange' ? 'exchange_requested' : 'return_requested';

    await db.collection('orders').doc(orderNumber).update({
      returnStatus,
      returnReason: reason,
      returnNotes: notes,
      returnRequestedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return jsonResponse(200, {
      success: true,
      message: `Your ${actionType === 'exchange' ? 'exchange' : 'return'} request has been registered. Our concierge will contact you within 24 hours.`,
      orderNumber,
      returnStatus
    });
  } catch (err: any) {
    console.error('[customer-return-request] Error:', err);
    return errorResponse(500, 'Unable to submit return request. Please contact customer support.');
  }
};
