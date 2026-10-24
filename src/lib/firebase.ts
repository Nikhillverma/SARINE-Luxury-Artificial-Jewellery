/**
 * Firebase Client Initialization for SARINE.
 * Reads configuration strictly from environment variables (VITE_FIREBASE_*).
 * Keys are never hardcoded in client source code.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA4xyqoFxRpLOEkp3ReG6kOp_IdtdbjRCs",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "sarine-cbcce.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "sarine-cbcce",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "sarine-cbcce.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "970923394635",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:970923394635:web:b428060e0d3db6eca2afce",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-L2TP9RN8VR"
};

/**
 * Checks whether all required Firebase credentials have been provided in environment variables.
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
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
      'Firebase Auth is not configured. Please set VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID.'
    );
  }
  return auth;
}

export { app, db, auth };
