/**
 * Firebase Client Initialization for SARINE.
 * Reads configuration defensively from environment variables (VITE_FIREBASE_*).
 * Automatically cleans quotes, trims whitespace, and extracts valid API keys
 * if a multi-line snippet was accidentally pasted into environment secrets.
 * Verified Project: sarine-cbcce
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const VERIFIED_FALLBACK_API_KEY = 'AIzaSyA4xyqoFxRpLOEkp3ReG6kOp_IdtdbjRCs';
const VERIFIED_FALLBACK_PROJECT_ID = 'sarine-cbcce';
const VERIFIED_FALLBACK_AUTH_DOMAIN = 'sarine-cbcce.firebaseapp.com';
const VERIFIED_FALLBACK_STORAGE_BUCKET = 'sarine-cbcce.firebasestorage.app';
const VERIFIED_FALLBACK_MESSAGING_SENDER_ID = '970923394635';
const VERIFIED_FALLBACK_APP_ID = '1:970923394635:web:b428060e0d3db6eca2afce';
const VERIFIED_FALLBACK_MEASUREMENT_ID = 'G-L2TP9RN8VR';

/**
 * Sanitizes and extracts a valid Firebase / Google Cloud API key.
 * Firebase Auth strictly rejects any API key containing colons (':') with auth/invalid-api-key.
 * If a multi-line config block, quotes, or whitespace was set in VITE_FIREBASE_API_KEY,
 * this function safely extracts the 39-character AIza key or falls back to the verified key.
 */
function sanitizeApiKey(rawKey?: string): string {
  if (!rawKey || typeof rawKey !== 'string') {
    return VERIFIED_FALLBACK_API_KEY;
  }

  const trimmed = rawKey.trim().replace(/^["'`]|["'`]$/g, '').trim();

  // If the secret contains the full snippet (e.g. apiKey: "AIzaSy..."), extract the exact key
  const match = trimmed.match(/(AIza[0-9A-Za-z_-]{35})/);
  if (match && match[1]) {
    return match[1];
  }

  // Reject malformed keys containing colons, newlines, or invalid format
  if (trimmed.includes(':') || trimmed.includes('\n') || trimmed.includes(' ') || !trimmed.startsWith('AIza')) {
    if (import.meta.env.DEV) {
      console.warn(
        '[Firebase] Malformed VITE_FIREBASE_API_KEY detected. Using verified project fallback API key.'
      );
    }
    return VERIFIED_FALLBACK_API_KEY;
  }

  return trimmed;
}

/**
 * Strips accidental quotes or multi-line garbage from an environment string.
 */
function cleanEnvString(rawVal: string | undefined, fallback: string): string {
  if (!rawVal || typeof rawVal !== 'string') return fallback;
  const cleaned = rawVal.trim().replace(/^["'`]|["'`]$/g, '').trim();
  if (cleaned.includes('\n') || cleaned.includes('{') || cleaned.includes(';')) {
    return fallback;
  }
  return cleaned || fallback;
}

const firebaseConfig = {
  apiKey: sanitizeApiKey(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: cleanEnvString(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, VERIFIED_FALLBACK_AUTH_DOMAIN),
  projectId: cleanEnvString(import.meta.env.VITE_FIREBASE_PROJECT_ID, VERIFIED_FALLBACK_PROJECT_ID),
  storageBucket: cleanEnvString(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, VERIFIED_FALLBACK_STORAGE_BUCKET),
  messagingSenderId: cleanEnvString(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, VERIFIED_FALLBACK_MESSAGING_SENDER_ID),
  appId: cleanEnvString(import.meta.env.VITE_FIREBASE_APP_ID, VERIFIED_FALLBACK_APP_ID),
  measurementId: cleanEnvString(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, VERIFIED_FALLBACK_MEASUREMENT_ID)
};

/**
 * Checks whether all required Firebase credentials are present and valid.
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.includes(':') &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (err) {
    console.error('[Firebase] Initialization error:', err);
  }
} else {
  if (import.meta.env.DEV) {
    console.info(
      '[Firebase] VITE_FIREBASE_* environment variables not detected. Running with mock data layer until configured.'
    );
  }
}

/**
 * Returns the initialized Firestore instance.
 * Throws a helpful error if accessed when Firebase credentials are not yet configured.
 */
export function getDb(): Firestore {
  if (!db) {
    throw new Error(
      'Firebase is not configured. Please set VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID in your environment variables, or switch DATA_SOURCE to "mock".'
    );
  }
  return db;
}

/**
 * Returns the initialized Firebase Auth instance.
 * Guarantees a single shared Auth singleton for login, password reset, and session checks.
 */
export function getFirebaseAuth(): Auth {
  if (!auth) {
    if (!app && isFirebaseConfigured()) {
      app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    }
    if (app) {
      auth = getAuth(app);
      return auth;
    }
    throw new Error(
      'Firebase Auth is not configured. Please verify your Firebase configuration in src/lib/firebase.ts.'
    );
  }
  return auth;
}

export { app, db, auth };

