/**
 * Netlify Function: admin-update-order
 *
 * Secure admin endpoint to update order status, courier info, cancellations, and notes.
 * Enforces strict transaction and business rules:
 * - NO action may set paymentStatus to 'paid' for online orders.
 * - NO action may set or edit razorpayPaymentId.
 * - Restores inventory atomically in a transaction when cancelling an order where stock was decremented.
 * - Writes updatedAt on every mutation.
 */

import { Handler } from '@netlify/functions';
import { getFirebaseAdmin, Transaction } from './utils/firebaseAdmin';
import { verifyAdminRequest } from './utils/adminAuth';
import { jsonResponse, errorResponse } from './utils/security';

const ALLOWED_ACTIONS = ['mark_shipped', 'mark_delivered', 'cancel', 'add_note'] as const;
type AdminAction = (typeof ALLOWED_ACTIONS)[number];

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(204, {});
  }

  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  // 1. Verify Admin Authentication
  const authCheck = await verifyAdminRequest(event);
  if (!authCheck.authorized || !authCheck.user) {
    return authCheck.response!;
  }

  try {
    let body: any = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch {
        return errorResponse(400, 'Invalid JSON body.');
      }
    }

    const { orderNumber, action, courierName, trackingNumber, trackingUrl, note, adminNote } = body;

    // Validate orderNumber
    if (!orderNumber || typeof orderNumber !== 'string' || !/^SAR-\d{6}$/.test(orderNumber.trim())) {
      return errorResponse(400, 'Invalid or missing order reference number (e.g. SAR-000123).');
    }

    const cleanOrderNumber = orderNumber.trim();

    // Validate action
    if (!action || typeof action !== 'string' || !ALLOWED_ACTIONS.includes(action as AdminAction)) {
      return errorResponse(
        400,
        `Invalid action "${action}". Allowed actions: ${ALLOWED_ACTIONS.join(', ')}.`
      );
    }

    const adminAction = action as AdminAction;
    const { db } = getFirebaseAdmin();
    const orderRef = db.collection('orders').doc(cleanOrderNumber);
    const nowIso = new Date().toISOString();

    // Handle "add_note"
    if (adminAction === 'add_note') {
      const targetNote = typeof note === 'string' ? note : typeof adminNote === 'string' ? adminNote : '';
      const trimmedNote = targetNote.trim();

      if (trimmedNote.length > 500) {
        return errorResponse(400, 'Admin note exceeds maximum length of 500 characters.');
      }

      const docSnap = await orderRef.get();
      if (!docSnap.exists) {
        return errorResponse(404, 'We could not find the specified order.');
      }

      await orderRef.update({
        adminNote: trimmedNote,
        updatedAt: nowIso
      });

      return jsonResponse(200, {
        success: true,
        orderNumber: cleanOrderNumber,
        action: 'add_note',
        adminNote: trimmedNote,
        updatedAt: nowIso
      });
    }

    // Handle "mark_shipped"
    if (adminAction === 'mark_shipped') {
      const docSnap = await orderRef.get();
      if (!docSnap.exists) {
        return errorResponse(404, 'We could not find the specified order.');
      }

      const orderData = docSnap.data()!;

      // Allowed only if paymentStatus is 'paid' OR paymentMethod is 'cod'
      const isPaid = orderData.paymentStatus === 'paid';
      const isCod = orderData.paymentMethod === 'cod';

      if (!isPaid && !isCod) {
        return errorResponse(
          400,
          'Cannot mark order as shipped: Payment is neither paid nor configured for Cash on Delivery.'
        );
      }

      if (orderData.orderStatus === 'cancelled') {
        return errorResponse(400, 'Cannot ship a cancelled order.');
      }

      const updatePayload: Record<string, any> = {
        orderStatus: 'shipped',
        shippedAt: nowIso,
        updatedAt: nowIso
      };

      if (typeof courierName === 'string' && courierName.trim()) {
        updatePayload.courierName = courierName.trim();
      }

      if (typeof trackingNumber === 'string' && trackingNumber.trim()) {
        updatePayload.trackingNumber = trackingNumber.trim();
      }

      if (typeof trackingUrl === 'string' && trackingUrl.trim()) {
        const cleanUrl = trackingUrl.trim();
        if (!cleanUrl.startsWith('https://')) {
          return errorResponse(400, 'Tracking URL must begin with https://');
        }
        updatePayload.trackingUrl = cleanUrl;
      }

      await orderRef.update(updatePayload);

      return jsonResponse(200, {
        success: true,
        orderNumber: cleanOrderNumber,
        action: 'mark_shipped',
        orderStatus: 'shipped',
        shippedAt: nowIso,
        updatedAt: nowIso
      });
    }

    // Handle "mark_delivered"
    if (adminAction === 'mark_delivered') {
      const docSnap = await orderRef.get();
      if (!docSnap.exists) {
        return errorResponse(404, 'We could not find the specified order.');
      }

      const orderData = docSnap.data()!;

      // Allowed ONLY if orderStatus is 'shipped'
      if (orderData.orderStatus !== 'shipped') {
        return errorResponse(
          400,
          `Cannot mark as delivered: Order is currently "${orderData.orderStatus}". Orders must be marked "shipped" first.`
        );
      }

      const updatePayload: Record<string, any> = {
        orderStatus: 'delivered',
        deliveredAt: nowIso,
        updatedAt: nowIso
      };

      // For COD orders also set paymentStatus 'paid' with paidAt now and paymentMode 'cod_collected'
      // NEVER set razorpayPaymentId
      if (orderData.paymentMethod === 'cod') {
        updatePayload.paymentStatus = 'paid';
        updatePayload.paidAt = nowIso;
        updatePayload.paymentMode = 'cod_collected';
      }

      await orderRef.update(updatePayload);

      return jsonResponse(200, {
        success: true,
        orderNumber: cleanOrderNumber,
        action: 'mark_delivered',
        orderStatus: 'delivered',
        deliveredAt: nowIso,
        updatedAt: nowIso
      });
    }

    // Handle "cancel"
    if (adminAction === 'cancel') {
      // Allowed only if orderStatus is 'pending', 'placed' or 'confirmed' and not shipped
      const result = await db.runTransaction(async (t: Transaction) => {
        const freshDoc = await t.get(orderRef);
        if (!freshDoc.exists) {
          throw new Error('NOT_FOUND');
        }

        const order = freshDoc.data()!;
        const currentStatus = order.orderStatus;

        if (currentStatus === 'shipped' || currentStatus === 'delivered') {
          throw new Error('ALREADY_SHIPPED');
        }

        if (currentStatus === 'cancelled') {
          throw new Error('ALREADY_CANCELLED');
        }

        if (!['pending', 'placed', 'confirmed'].includes(currentStatus)) {
          throw new Error(`INVALID_STATUS_${currentStatus}`);
        }

        // Determine if stock had been decremented
        // Stock is decremented for paid online orders and all COD orders (placed)
        const isPaid = order.paymentStatus === 'paid';
        const isCod = order.paymentMethod === 'cod';
        const stockWasDecremented = isPaid || isCod;

        // If stock was decremented, restore stock for all lines
        if (stockWasDecremented && Array.isArray(order.lines)) {
          for (const line of order.lines) {
            if (line.productId && Number(line.quantity) > 0) {
              const pRef = db.collection('products').doc(line.productId);
              const pDoc = await t.get(pRef);
              if (pDoc.exists) {
                const currentStock = Number(pDoc.data()?.stock) || 0;
                t.update(pRef, {
                  stock: currentStock + Number(line.quantity),
                  updatedAt: nowIso
                });
              }
            }
          }
        }

        const updatePayload: Record<string, any> = {
          orderStatus: 'cancelled',
          cancelledAt: nowIso,
          updatedAt: nowIso
        };

        // If the order was paid, also set refundNeeded: true
        if (isPaid) {
          updatePayload.refundNeeded = true;
        }

        t.update(orderRef, updatePayload);

        return {
          orderNumber: cleanOrderNumber,
          isPaid,
          refundNeeded: isPaid,
          stockRestored: stockWasDecremented
        };
      });

      return jsonResponse(200, {
        success: true,
        orderNumber: cleanOrderNumber,
        action: 'cancel',
        orderStatus: 'cancelled',
        refundNeeded: result.refundNeeded,
        stockRestored: result.stockRestored,
        cancelledAt: nowIso,
        updatedAt: nowIso
      });
    }

    return errorResponse(400, 'Unknown action.');
  } catch (err: any) {
    if (err?.message === 'NOT_FOUND') {
      return errorResponse(404, 'We could not find the specified order.');
    }
    if (err?.message === 'ALREADY_SHIPPED') {
      return errorResponse(400, 'Cannot cancel an order that has already shipped or delivered.');
    }
    if (err?.message === 'ALREADY_CANCELLED') {
      return errorResponse(400, 'Order is already cancelled.');
    }
    if (err?.message?.startsWith('INVALID_STATUS_')) {
      return errorResponse(400, 'Order cannot be cancelled in its current status.');
    }

    console.error('[admin-update-order Server Error]', err);
    return errorResponse(500, 'Unable to update order. Please try again.', err);
  }
};
