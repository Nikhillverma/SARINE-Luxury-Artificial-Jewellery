/**
 * Razorpay SDK helper for Netlify Functions.
 * Reads Razorpay API Key ID and Key Secret strictly from server environment variables.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - razorpay package provides runtime JS
import Razorpay from 'razorpay';

export function getRazorpay(): any {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error(
      'Razorpay is not configured on the server. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables.'
    );
  }

  return new Razorpay({
    key_id,
    key_secret
  });
}
