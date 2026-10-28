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

export const DEFAULT_ALLOWED_ORIGINS = [
  'https://sarine-cbcce.web.app',
  'https://sarine-cbcce.firebaseapp.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8888',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8888',
  'https://ais-dev-dfone66vl7yl2v7fczwuah-732230674945.asia-northeast1.run.app',
  'https://ais-pre-dfone66vl7yl2v7fczwuah-732230674945.asia-northeast1.run.app'
];

export function getAllowedOrigins(): string[] {
  const list = [...DEFAULT_ALLOWED_ORIGINS];

  // Optional comma-separated custom origins from server environment
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins) {
    for (const raw of envOrigins.split(',')) {
      const trimmed = raw.trim().toLowerCase();
      if (trimmed && !list.includes(trimmed)) {
        list.push(trimmed);
      }
    }
  }

  // Custom domain support from CUSTOM_DOMAIN if configured (e.g. sarine.in)
  const customDomain = process.env.CUSTOM_DOMAIN?.trim().toLowerCase();
  if (customDomain) {
    const cleanDomain = customDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const httpsApex = `https://${cleanDomain}`;
    const httpsWww = `https://www.${cleanDomain}`;
    if (!list.includes(httpsApex)) list.push(httpsApex);
    if (!list.includes(httpsWww)) list.push(httpsWww);
  }

  return list;
}

export function resolveAllowedOrigin(requestOrigin?: string): string {
  if (!requestOrigin || typeof requestOrigin !== 'string') {
    return 'https://sarine-cbcce.web.app';
  }
  const clean = requestOrigin.trim().toLowerCase().replace(/\/$/, '');
  const allowed = getAllowedOrigins();
  if (allowed.includes(clean)) {
    return requestOrigin.trim();
  }
  // Do not reflect untrusted origin; default to primary production domain
  return 'https://sarine-cbcce.web.app';
}

export function getCorsHeaders(requestOrigin?: string): Record<string, string> {
  const origin = resolveAllowedOrigin(requestOrigin);
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

export function handlePreflight(event?: { headers?: Record<string, string | undefined> }) {
  const rawOrigin = event?.headers?.origin || event?.headers?.Origin;
  return {
    statusCode: 204,
    headers: {
      ...getCorsHeaders(rawOrigin),
      'Content-Length': '0'
    },
    body: ''
  };
}

export function jsonResponse(
  statusCode: number,
  data: unknown,
  eventOrOrigin?: { headers?: Record<string, string | undefined> } | string
) {
  const rawOrigin = typeof eventOrOrigin === 'string'
    ? eventOrOrigin
    : (eventOrOrigin?.headers?.origin || eventOrOrigin?.headers?.Origin);

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(rawOrigin)
    },
    body: statusCode === 204 ? '' : JSON.stringify(data)
  };
}

export function errorResponse(
  statusCode: number,
  publicMessage: string,
  logContext?: unknown,
  eventOrOrigin?: { headers?: Record<string, string | undefined> } | string
) {
  if (logContext) {
    console.error(`[Server Error ${statusCode}]`, logContext);
  }
  return jsonResponse(statusCode, { error: publicMessage }, eventOrOrigin);
}
