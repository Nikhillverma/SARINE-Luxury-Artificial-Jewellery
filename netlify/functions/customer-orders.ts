/**
 * Netlify Function: customer-orders
 *
 * Secure customer endpoint for retrieving authenticated customer order history.
 * Requires valid Firebase Authentication ID token via Authorization: Bearer <token>.
 * Validates token and strictly matches customer.email or customer.userId.
 * Returns only safe fields for the verified customer, sorted by createdAt descending.
 */

import { Handler } from '@netlify/functions';
import { getFirebaseAdmin } from './utils/firebaseAdmin';
import { jsonResponse, errorResponse, handlePreflight } from './utils/security';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return handlePreflight(event);
  }

  if (event.httpMethod !== 'GET') {
    return errorResponse(405, 'Method not allowed');
  }

  // 1. Verify Customer Authentication via Bearer Token
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(401, 'Please sign in to view your orders.');
  }

  const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!idToken) {
    return errorResponse(401, 'Please sign in to view your orders.');
  }

  const { auth, db } = getFirebaseAdmin();
  let customerEmail = '';
  let customerUid = '';

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    customerEmail = (decodedToken.email || '').trim().toLowerCase();
    customerUid = decodedToken.uid || '';

    if (!customerEmail && !customerUid) {
      return errorResponse(401, 'Invalid user identity token.');
    }
  } catch (authErr) {
    console.error('[customer-orders] Token verification failed:', authErr);
    return errorResponse(401, 'Your session has expired. Please sign in again.');
  }

  try {
    const ordersMap = new Map<string, any>();

    // 2. Query orders by customer email (if present)
    if (customerEmail) {
      const emailSnap = await db
        .collection('orders')
        .where('customer.email', '==', customerEmail)
        .get();

      emailSnap.docs.forEach((doc) => {
        ordersMap.set(doc.id, doc.data());
      });
    }

    // 3. Query orders by customer userId (if present)
    if (customerUid) {
      const uidSnap = await db
        .collection('orders')
        .where('customer.userId', '==', customerUid)
        .get();

      uidSnap.docs.forEach((doc) => {
        ordersMap.set(doc.id, doc.data());
      });
    }

    // 4. Transform and sanitize customer orders
    const allOrders = Array.from(ordersMap.values()).map((data) => {
      const orderNumber = data.orderNumber || data.id;

      // Extract only safe storefront fields for the customer
      return {
        id: orderNumber,
        orderNumber,
        createdAt: data.createdAt || new Date().toISOString(),
        customer: {
          name: data.customer?.name || '',
          email: data.customer?.email || '',
          phone: data.customer?.phone || '',
          userId: data.customer?.userId || ''
        },
        shippingAddress: {
          fullName: data.shippingAddress?.fullName || data.customer?.name || '',
          phone: data.shippingAddress?.phone || data.customer?.phone || '',
          line1: data.shippingAddress?.line1 || '',
          line2: data.shippingAddress?.line2 || '',
          city: data.shippingAddress?.city || '',
          state: data.shippingAddress?.state || '',
          pincode: data.shippingAddress?.pincode || ''
        },
        lines: Array.isArray(data.lines)
          ? data.lines.map((line: any) => ({
              productId: line.productId || '',
              name: line.name || '',
              image: line.image || '',
              quantity: Number(line.quantity) || 1,
              unitPrice: Number(line.unitPrice) || 0,
              sku: line.sku || `SAR-${(line.productId || '').slice(0, 6).toUpperCase()}`
            }))
          : [],
        subtotal: Number(data.subtotal) || 0,
        shippingFee: Number(data.shippingFee) || 0,
        total: Number(data.total) || 0,
        paymentMethod: data.paymentMethod || 'online',
        paymentStatus: data.paymentStatus || 'pending',
        orderStatus: data.orderStatus || 'placed',
        publicToken: data.publicToken || undefined,
        razorpayPaymentId: data.paymentStatus === 'paid' ? data.razorpayPaymentId : undefined,
        courierName: data.courierName || undefined,
        trackingNumber: data.trackingNumber || undefined,
        trackingUrl: data.trackingUrl || undefined,
        shippedAt: data.shippedAt || undefined,
        deliveredAt: data.deliveredAt || undefined,
        estimatedDelivery: data.estimatedDelivery || undefined,
        cancelledAt: data.cancelledAt || undefined,
        cancellationReason: data.cancellationReason || undefined,
        refundNeeded: data.refundNeeded || undefined,
        refundAmount: data.refundAmount || undefined,
        returnStatus: data.returnStatus || 'none',
        returnReason: data.returnReason || undefined,
        returnNotes: data.returnNotes || undefined
      };
    });

    // 5. Sort by newest first
    allOrders.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return jsonResponse(200, {
      orders: allOrders,
      totalCount: allOrders.length
    });
  } catch (err: any) {
    console.error('[customer-orders] Database error:', err);
    return errorResponse(500, 'Unable to load orders. Please try again later.');
  }
};
