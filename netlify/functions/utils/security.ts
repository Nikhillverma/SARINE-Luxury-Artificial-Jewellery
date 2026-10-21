/**
 * Security, validation, and response helpers for Netlify Functions.
 */

import crypto from 'crypto';

export function timingSafeCompare(a: unknown, b: unknown): boolean {
  try {
    if (typeof a !== 'string' || typeof b !== 'string') {
      return false;
    }
    if (a.length === 0 || b.length === 0) {
      return false;
    }
    if (a.length !== b.length) {
      return false;
    }
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

export function errorResponse(statusCode: number, publicMessage: string, logContext?: unknown) {
  if (logContext) {
    console.error(`[Server Error ${statusCode}]`, logContext);
  }
  return jsonResponse(statusCode, { error: publicMessage });
}
