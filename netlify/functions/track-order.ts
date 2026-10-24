/**
 * Netlify Function: track-order
 *
 * Secure, rate-limited customer order tracking endpoint.
 * Requires valid orderNumber (SAR-XXXXXX) and last 10 digits of customer or shipping phone.
 * Returns only safe storefront display fields without exposing internal secrets,
 * customer phone, or full street address.
 */

import { Handler } from '@netlify/functions';
import crypto from 'crypto';
import { getFirebaseAdmin } from './utils/firebaseAdmin';
import { timingSafeCompare, jsonResponse, errorResponse } from './utils/security';

const RATE_LIMIT_COLLECTION = '_rate_limits';
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;
const GENERIC_NOT_FOUND = "We couldn't find an order with those details.";

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(204, {});
  }

  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  try {
    let body: any = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch {
        return errorResponse(400, 'Invalid JSON body');
      }
    }

    // 1. Rate Limiting by Client IP (hashed with sha256)
    const rawIp =
      event.headers['x-nf-client-connection-ip'] ||
      event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      event.headers['client-ip'] ||
      '127.0.0.1';

    const ipHash = crypto.createHash('sha256').update(rawIp).digest('hex');

    const { db } = getFirebaseAdmin();
    const rateLimitRef = db.collection(RATE_LIMIT_COLLECTION).doc(ipHash);
    const now = Date.now();

    try {
      const rateDoc = await rateLimitRef.get();
      if (rateDoc.exists) {
        const rateData = rateDoc.data() || {};
        const windowStart = Number(rateData.windowStart) || 0;
        const currentCount = Number(rateData.count) || 0;

        if (now - windowStart < WINDOW_MS) {
          if (currentCount >= MAX_ATTEMPTS) {
            return errorResponse(429, 'Too many attempts. Please try again later.');
          }
          await rateLimitRef.update({
            count: currentCount + 1
          });
        } else {
          // Reset window
          await rateLimitRef.set({
            count: 1,
            windowStart: now
          });
        }
      } else {
        await rateLimitRef.set({
          count: 1,
          windowStart: now
        });
      }
    } catch (rateErr) {
      console.error('[track-order] Rate limit check error:', rateErr);
      // Continue safely if rate limit collection write has transient issue
    }

    // 2. Normalisation & Validation
    const rawOrderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim().toUpperCase() : '';
    const rawPhone = typeof body.phone === 'string' ? body.phone : String(body.phone || '');
    const phoneDigits = rawPhone.replace(/\D/g, '').slice(-10);

    // Validate format: orderNumber must match /^SAR-\d{6}$/ and phone must have exactly 10 digits
    if (!/^SAR-\d{6}$/.test(rawOrderNumber) || phoneDigits.length !== 10) {
      return errorResponse(404, GENERIC_NOT_FOUND);
    }

    // 3. Load order
    const orderDoc = await db.collection('orders').doc(rawOrderNumber).get();
    if (!orderDoc.exists) {
      return errorResponse(404, GENERIC_NOT_FOUND);
    }

    const orderData = orderDoc.data() || {};

    // 4. Compare last 10 digits of customer phone and shippingAddress phone using timingSafeCompare
    const customerPhone = String(orderData.customer?.phone || '').replace(/\D/g, '').slice(-10);
    const shippingPhone = String(orderData.shippingAddress?.phone || '').replace(/\D/g, '').slice(-10);

    const matchCustomer = timingSafeCompare(customerPhone, phoneDigits);
    const matchShipping = timingSafeCompare(shippingPhone, phoneDigits);

    if (!matchCustomer && !matchShipping) {
      return errorResponse(404, GENERIC_NOT_FOUND);
    }

    // 5. On success return ONLY safe fields
    const safeOrder: Record<string, any> = {
      orderNumber: orderData.orderNumber || rawOrderNumber,
      publicToken: orderData.publicToken || '',
      createdAt: orderData.createdAt || new Date().toISOString(),
      lines: Array.isArray(orderData.lines)
        ? orderData.lines.map((line: any) => ({
            name: line.name || '',
            image: line.image || '',
            quantity: Number(line.quantity) || 1,
            unitPrice: Number(line.unitPrice) || 0
          }))
        : [],
      subtotal: Number(orderData.subtotal) || 0,
      shippingFee: Number(orderData.shippingFee) || 0,
      total: Number(orderData.total) || 0,
      paymentMethod: orderData.paymentMethod || 'online',
      paymentStatus: orderData.paymentStatus || 'pending',
      orderStatus: orderData.orderStatus || 'placed',
      shippingAddress: {
        city: orderData.shippingAddress?.city || '',
        state: orderData.shippingAddress?.state || '',
        pincode: orderData.shippingAddress?.pincode || ''
      }
    };

    // Return razorpayPaymentId only if paid
    if (orderData.paymentStatus === 'paid' && orderData.razorpayPaymentId) {
      safeOrder.razorpayPaymentId = orderData.razorpayPaymentId;
    }

    // Optional courier and tracking fields if present
    if (orderData.courierName) safeOrder.courierName = orderData.courierName;
    if (orderData.trackingUrl) safeOrder.trackingUrl = orderData.trackingUrl;
    if (orderData.trackingNumber) safeOrder.trackingNumber = orderData.trackingNumber;
    if (orderData.shippedAt) safeOrder.shippedAt = orderData.shippedAt;
    if (orderData.deliveredAt) safeOrder.deliveredAt = orderData.deliveredAt;

    return jsonResponse(200, safeOrder);
  } catch (err: any) {
    console.error('[track-order Server Error]', err);
    return errorResponse(500, 'Something went wrong. Please try again.', err);
  }
};
