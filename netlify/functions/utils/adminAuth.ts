/**
 * Admin Authentication verification helper for Netlify Functions.
 *
 * Checks Bearer ID token with Firebase Admin Auth, verifies user email,
 * and ensures email is present in ADMIN_EMAILS environment variable.
 * Catch blocks return a generic message and only log the real error.
 */

import { DecodedIdToken } from 'firebase-admin/auth';
import { getFirebaseAdmin } from './firebaseAdmin';
import { errorResponse } from './security';

export interface AdminAuthResult {
  authorized: boolean;
  user?: DecodedIdToken;
  response?: ReturnType<typeof errorResponse>;
}

export async function verifyAdminRequest(event: {
  headers: Record<string, string | undefined>;
}): Promise<AdminAuthResult> {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;

  if (!authHeader || typeof authHeader !== 'string') {
    return {
      authorized: false,
      response: errorResponse(401, 'Unauthorized: Authentication required.', undefined, event)
    };
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return {
      authorized: false,
      response: errorResponse(401, 'Unauthorized: Invalid authentication format.', undefined, event)
    };
  }

  const idToken = parts[1];
  if (!idToken) {
    return {
      authorized: false,
      response: errorResponse(401, 'Unauthorized: Token missing.', undefined, event)
    };
  }

  try {
    const { auth } = getFirebaseAdmin();
    const decoded = await auth.verifyIdToken(idToken);

    const email = decoded.email?.trim().toLowerCase();
    if (!email) {
      console.warn('[adminAuth] Token valid but contains no email address for uid:', decoded.uid);
      return {
        authorized: false,
        response: errorResponse(403, 'Forbidden: Admin access denied.', undefined, event)
      };
    }

    const adminEmailsRaw = process.env.ADMIN_EMAILS || '';
    const allowedEmails = adminEmailsRaw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (allowedEmails.length === 0) {
      console.error('[adminAuth] ADMIN_EMAILS server environment variable is not configured.');
      return {
        authorized: false,
        response: errorResponse(403, 'Forbidden: Admin access not configured.', undefined, event)
      };
    }

    if (!allowedEmails.includes(email)) {
      console.warn(`[adminAuth] Access denied for user "${email}". Not in ADMIN_EMAILS list.`);
      return {
        authorized: false,
        response: errorResponse(403, 'Forbidden: Admin access denied.', undefined, event)
      };
    }

    return {
      authorized: true,
      user: decoded
    };
  } catch (err: any) {
    console.error('[adminAuth] Failed to verify ID token:', err);
    return {
      authorized: false,
      response: errorResponse(401, 'Unauthorized: Session invalid or expired.', err, event)
    };
  }
}
