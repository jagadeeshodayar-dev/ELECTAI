import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInAnonymously, signInWithPopup } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function signInGuest() {
  return signInAnonymously(auth);
}

export function getFirebaseAuthMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';

  if (code === 'auth/unauthorized-domain') {
    return 'Firebase Auth blocked this domain. Add localhost, 127.0.0.1, and your deployed domain in Firebase Console > Authentication > Settings > Authorized domains.';
  }

  if (code === 'auth/operation-not-allowed') {
    return 'This Firebase sign-in method is disabled. Enable Google and Anonymous sign-in in Firebase Console > Authentication > Sign-in method.';
  }

  if (code === 'auth/popup-blocked') {
    return 'The browser blocked the Google sign-in popup. Allow popups for this app and try again.';
  }

  return error instanceof Error ? error.message : 'Authentication is not available right now.';
}
