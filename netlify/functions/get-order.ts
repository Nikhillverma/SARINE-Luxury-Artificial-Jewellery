/**
 * Netlify Function: get-order
 *
 * Secure order retrieval endpoint. Requires matching the unguessable publicToken.
 * Returns only safe storefront display fields without exposing internal secrets.
 */

import { Handler } from '@netlify/functions';
import { getFirebaseAdmin } from './utils/firebaseAdmin';
import { timingSafeCompare, jsonResponse, errorResponse } from './utils/security';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(204, {});
  }

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  try {
    let orderNumber: string | undefined;
    let publicToken: string | undefined;

    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      orderNumber = params.orderNumber;
      publicToken = params.t || params.publicToken;
    } else {
      if (event.body) {
        try {
          const body = JSON.parse(event.body);
          orderNumber = body.orderNumber;
          publicToken = body.publicToken || body.t;
        } catch {
          return errorResponse(400, 'Invalid JSON body');
        }
      }
    }

    if (!orderNumber || !publicToken) {
      return errorResponse(404, "We couldn't find this order");
    }

    const { db } = getFirebaseAdmin();
    const cleanNumber = orderNumber.trim();
    const orderDoc = await db.collection('orders').doc(cleanNumber).get();

    if (!orderDoc.exists) {
      return errorResponse(404, "We couldn't find this order");
    }

    const orderData = orderDoc.data()!;

    // Cryptographic timing-safe comparison of the unguessable publicToken
    const storedToken = orderData.publicToken || '';
    if (!timingSafeCompare(storedToken, publicToken.trim())) {
      return errorResponse(404, "We couldn't find this order");
    }

    // Return only safe fields
    const safeOrder = {
      id: orderData.id || orderData.orderNumber,
      orderNumber: orderData.orderNumber,
      lines: orderData.lines || [],
      customer: {
        name: orderData.customer?.name || '',
        email: orderData.customer?.email || '',
        phone: orderData.customer?.phone || ''
      },
      shippingAddress: orderData.shippingAddress || {},
      subtotal: orderData.subtotal || 0,
      shippingFee: orderData.shippingFee || 0,
      total: orderData.total || 0,
      paymentMethod: orderData.paymentMethod || 'online',
      paymentStatus: orderData.paymentStatus || 'pending',
      orderStatus: orderData.orderStatus || 'placed',
      createdAt: orderData.createdAt || new Date().toISOString()
    };

    return jsonResponse(200, safeOrder);
  } catch (err: any) {
    return errorResponse(500, "We couldn't find this order", err.stack);
  }
};
