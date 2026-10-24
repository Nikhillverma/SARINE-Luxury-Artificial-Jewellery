/**
 * Firebase Admin SDK initialization for Netlify Functions.
 * Reads server-side credentials securely from environment variables.
 * Keys are never exposed to browser bundles.
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore, Transaction } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

let appInstance: App | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;
let settingsConfigured = false;

export function getFirebaseAdmin(): { app: App; db: Firestore; auth: Auth } {
  if (!dbInstance) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    let credentialCert: any = null;

    if (serviceAccountJson) {
      try {
        const raw = serviceAccountJson.trim().startsWith('{')
          ? serviceAccountJson
          : Buffer.from(serviceAccountJson, 'base64').toString('utf8');
        const parsed = JSON.parse(raw);
        credentialCert = cert(parsed);
      } catch (e) {
        console.error('[FirebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', e);
      }
    }

    if (!credentialCert) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (!projectId || !clientEmail || !rawPrivateKey) {
        throw new Error(
          'Firebase Admin SDK is not configured on the server. Please ensure FIREBASE_SERVICE_ACCOUNT (JSON) or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set in environment variables.'
        );
      }

      // Replace literal escaped \n with real newlines for PEM format
      const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
      credentialCert = cert({
        projectId,
        clientEmail,
        privateKey
      });
    }

    if (getApps().length === 0) {
      appInstance = initializeApp({
        credential: credentialCert
      });
    } else {
      appInstance = getApps()[0];
    }

    const firestoreDb = getFirestore();
    if (!settingsConfigured) {
      firestoreDb.settings({ ignoreUndefinedProperties: true });
      settingsConfigured = true;
    }
    dbInstance = firestoreDb;
    authInstance = getAuth(appInstance!);
  }

  return {
    app: appInstance!,
    db: dbInstance,
    auth: authInstance!
  };
}

export type { Firestore, Transaction, Auth };
