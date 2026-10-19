/**
 * Firebase Admin SDK initialization for Netlify Functions.
 * Reads server-side credentials securely from environment variables.
 * Keys are never exposed to browser bundles.
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore, Transaction } from 'firebase-admin/firestore';

let appInstance: App | null = null;
let dbInstance: Firestore | null = null;

export function getFirebaseAdmin(): { app: App; db: Firestore } {
  if (!dbInstance) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !rawPrivateKey) {
      throw new Error(
        'Firebase Admin SDK is not configured on the server. Please ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set in environment variables.'
      );
    }

    // Replace literal escaped \n with real newlines for PEM format
    const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

    if (getApps().length === 0) {
      appInstance = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey
        })
      });
    } else {
      appInstance = getApps()[0];
    }

    dbInstance = getFirestore();
  }

  return {
    app: appInstance!,
    db: dbInstance
  };
}

export type { Firestore, Transaction };
