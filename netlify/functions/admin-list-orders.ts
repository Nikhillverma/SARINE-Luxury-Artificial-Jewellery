/**
 * Netlify Function: admin-list-orders
 *
 * Secure admin endpoint for listing customer orders with status filtering and pagination.
 * Protected with Firebase Admin ID token verification and ADMIN_EMAILS allowlist.
 * NEVER returns publicToken or razorpaySignature.
 */

import { Handler } from '@netlify/functions';
import { getFirebaseAdmin } from './utils/firebaseAdmin';
import { verifyAdminRequest } from './utils/adminAuth';
import { jsonResponse, errorResponse } from './utils/security';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(204, {});
  }

  if (event.httpMethod !== 'GET') {
    return errorResponse(405, 'Method not allowed');
  }

  // 1. Verify Admin Authentication
  const authCheck = await verifyAdminRequest(event);
  if (!authCheck.authorized || !authCheck.user) {
    return authCheck.response!;
  }

  try {
    const params = event.queryStringParameters || {};
    const rawLimit = parseInt(params.limit || '50', 10);
    const pageLimit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100);

    const filterStatus = params.status?.trim();
    const filterPaymentStatus = params.paymentStatus?.trim();
    const startAfter = params.startAfter?.trim();

    const { db } = getFirebaseAdmin();
    let queryRef: FirebaseFirestore.Query = db.collection('orders');

    if (filterStatus) {
      queryRef = queryRef.where('orderStatus', '==', filterStatus);
    }

    if (filterPaymentStatus) {
      queryRef = queryRef.where('paymentStatus', '==', filterPaymentStatus);
    }

    queryRef = queryRef.orderBy('createdAt', 'desc');

    if (startAfter) {
      // Check if startAfter is an orderNumber doc or timestamp
      const cursorDoc = await db.collection('orders').doc(startAfter).get();
      if (cursorDoc.exists) {
        queryRef = queryRef.startAfter(cursorDoc);
      } else {
        queryRef = queryRef.startAfter(startAfter);
      }
    }

    queryRef = queryRef.limit(pageLimit);

    const snapshot = await queryRef.get();

    const orders = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const orderNumber = data.orderNumber || docSnap.id;

      // Extract ONLY safe admin fields. NEVER return publicToken or razorpaySignature.
      return {
        orderNumber,
        createdAt: data.createdAt || new Date().toISOString(),
        customer: {
          name: data.customer?.name || '',
          email: data.customer?.email || '',
          phone: data.customer?.phone || ''
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
              unitPrice: Number(line.unitPrice) || 0
            }))
          : [],
        subtotal: Number(data.subtotal) || 0,
        shippingFee: Number(data.shippingFee) || 0,
        total: Number(data.total) || 0,
        paymentMethod: data.paymentMethod || 'online',
        paymentStatus: data.paymentStatus || 'pending',
        orderStatus: data.orderStatus || 'pending',
        razorpayPaymentId: data.razorpayPaymentId || undefined,
        courierName: data.courierName || undefined,
        trackingNumber: data.trackingNumber || undefined,
        trackingUrl: data.trackingUrl || undefined,
        shippedAt: data.shippedAt || undefined,
        deliveredAt: data.deliveredAt || undefined,
        adminNote: data.adminNote || undefined,
        refundNeeded: Boolean(data.refundNeeded || data.orderStatus === 'needs_refund'),
        cancelledAt: data.cancelledAt || undefined,
        updatedAt: data.updatedAt || undefined
      };
    });

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    const nextStartAfter = snapshot.docs.length >= pageLimit && lastDoc ? lastDoc.id : null;

    return jsonResponse(200, {
      orders,
      count: orders.length,
      nextStartAfter
    });
  } catch (err: any) {
    console.error('[admin-list-orders Server Error]', err);
    return errorResponse(500, 'Unable to load orders. Please try again.', err);
  }
};
