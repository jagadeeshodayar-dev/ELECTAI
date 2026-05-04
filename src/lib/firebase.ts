import type { FirebaseOptions } from 'firebase/app';
import { getApps, initializeApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  signInAnonymously,
  signInWithPopup,
  signOut,
} from 'firebase/auth';

type FirebaseConfigResponse = {
  configured: boolean;
  config?: FirebaseOptions;
  missing?: string[];
};

let authPromise: Promise<Auth> | null = null;

export const googleProvider = new GoogleAuthProvider();

async function loadFirebaseConfig() {
  const response = await fetch('/api/firebase-config', { cache: 'no-store' });
  const data = (await response.json()) as FirebaseConfigResponse;

  if (!response.ok || !data.configured || !data.config) {
    const missing = data.missing?.length ? data.missing.join(', ') : 'Firebase web config';
    throw new Error(`Firebase Auth is not configured for this Cloud Run service. Missing: ${missing}.`);
  }

  return data.config;
}

export async function getFirebaseAuth() {
  if (!authPromise) {
    authPromise = loadFirebaseConfig().then(async (config) => {
      const app = getApps().length ? getApps()[0] : initializeApp(config);
      const auth = getAuth(app);
      await setPersistence(auth, browserLocalPersistence);
      return auth;
    });
  }

  return authPromise;
}

export async function signInWithGoogle() {
  const auth = await getFirebaseAuth();
  return signInWithPopup(auth, googleProvider);
}

export async function signInGuest() {
  const auth = await getFirebaseAuth();
  return signInAnonymously(auth);
}

export async function signOutFirebase() {
  const auth = await getFirebaseAuth();
  return signOut(auth);
}

export function getFirebaseSetupMessage(currentHost = '') {
  const hostDetail = currentHost ? ` Add "${currentHost}" in Firebase Auth Authorized domains for this deployed host.` : '';
  return `Firebase Auth is not configured for this Cloud Run service. Set FIREBASE_WEB_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, and FIREBASE_APP_ID as Cloud Run env vars.${hostDetail}`;
}

export function getFirebaseAuthMessage(error: unknown, currentHost = '') {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const hostDetail = currentHost ? ` Current host: ${currentHost}.` : '';

  if (error instanceof Error && error.message.includes('Firebase Auth is not configured')) {
    return `${error.message}${hostDetail}`;
  }

  if (code === 'auth/unauthorized-domain') {
    return `Firebase Auth blocked this domain.${hostDetail} Add that exact host in Firebase Console > Authentication > Settings > Authorized domains. For local development, add localhost and 127.0.0.1 if you use both.`;
  }

  if (code === 'auth/operation-not-allowed') {
    return 'This Firebase sign-in method is disabled. Enable Google and Anonymous sign-in in Firebase Console > Authentication > Sign-in method.';
  }

  if (code === 'auth/popup-blocked') {
    return 'The browser blocked the Google sign-in popup. Allow popups for this app and try again.';
  }

  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in was closed before it completed.';
  }

  if (code === 'auth/invalid-api-key' || code === 'auth/configuration-not-found') {
    return 'Firebase Auth rejected this web app config. Recheck the Firebase web app API key, auth domain, project id, and app id in Cloud Run environment variables.';
  }

  if (code === 'auth/network-request-failed') {
    return 'Firebase Auth could not reach Google services. Check your network and Firebase project configuration.';
  }

  return error instanceof Error ? error.message : 'Authentication is temporarily offline.';
}
