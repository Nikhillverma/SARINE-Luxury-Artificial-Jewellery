/**
 * Security, validation, and response helpers for Netlify Functions.
 */

import crypto from 'crypto';

export function timingSafeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');

    if (bufA.length !== bufB.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function jsonResponse(statusCode: number, data: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    },
    body: JSON.stringify(data)
  };
}

export function errorResponse(statusCode: number, publicMessage: string, logContext?: string) {
  if (logContext) {
    console.error(`[Server Error ${statusCode}] ${logContext}`);
  }
  return jsonResponse(statusCode, { error: publicMessage });
}
