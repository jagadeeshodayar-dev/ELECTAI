'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth, getFirebaseAuthMessage, signInGuest, signInWithGoogle, signOutFirebase } from '@/lib/firebase';

type AuthStatus = 'loading' | 'restoring' | 'authenticated' | 'guest' | 'local-guest' | 'signed-out' | 'error';

type AuthProfile = {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  isAnonymous: boolean;
};

type AuthContextValue = {
  user: User | null;
  profile: AuthProfile | null;
  userId: string | null;
  status: AuthStatus;
  notice: string;
  signInAsGuest: () => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  clearNotice: () => void;
};

const AUTH_PROFILE_KEY = 'electai.auth.profile';
const AUTH_LOGOUT_KEY = 'electai.auth.loggedOut';

const AuthContext = createContext<AuthContextValue | null>(null);

function readCachedProfile() {
  if (typeof window === 'undefined' || window.localStorage.getItem(AUTH_LOGOUT_KEY) === '1') return null;

  try {
    const raw = window.localStorage.getItem(AUTH_PROFILE_KEY);
    return raw ? (JSON.parse(raw) as AuthProfile) : null;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: AuthProfile | null) {
  if (typeof window === 'undefined') return;
  if (!profile) {
    window.localStorage.removeItem(AUTH_PROFILE_KEY);
    return;
  }
  window.localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(profile));
}

function profileFromUser(user: User): AuthProfile {
  return {
    uid: user.uid,
    displayName: user.displayName || (user.isAnonymous ? 'Guest' : user.email?.split('@')[0] || 'Google user'),
    email: user.email || '',
    photoURL: user.photoURL || '',
    isAnonymous: user.isAnonymous,
  };
}

function createLocalGuestId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `local-guest-${crypto.randomUUID()}`
    : `local-guest-${Date.now()}`;
}

function currentHost() {
  return typeof window !== 'undefined' ? window.location.hostname : '';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [localGuestId, setLocalGuestId] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const cachedProfile = readCachedProfile();
    if (cachedProfile) {
      setProfile(cachedProfile);
      setStatus('restoring');
    }

    getFirebaseAuth()
      .then((firebaseAuth) => {
        if (cancelled) return;
        unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
          if (cancelled) return;

          setUser(firebaseUser);
          setLocalGuestId(null);

          if (firebaseUser) {
            const nextProfile = profileFromUser(firebaseUser);
            setProfile(nextProfile);
            writeCachedProfile(nextProfile);
            window.localStorage.removeItem(AUTH_LOGOUT_KEY);
            setStatus(firebaseUser.isAnonymous ? 'guest' : 'authenticated');
            return;
          }

          setProfile(null);
          writeCachedProfile(null);
          setStatus('signed-out');
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setProfile(null);
          setStatus('error');
          setNotice(getFirebaseAuthMessage(err, currentHost()));
        }
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  async function signInAsGuest() {
    setNotice('');
    try {
      await signInGuest();
      setNotice('Guest mode is signed in with Firebase Anonymous Auth.');
    } catch (err) {
      const guestId = createLocalGuestId();
      setUser(null);
      setProfile({
        uid: guestId,
        displayName: 'Local guest',
        email: '',
        photoURL: '',
        isAnonymous: true,
      });
      setLocalGuestId(guestId);
      setStatus('local-guest');
      setNotice(`${getFirebaseAuthMessage(err, currentHost())} Local guest mode is ready for this device while Firebase Auth is being configured.`);
    }
  }

  async function signInGoogle() {
    setNotice('');
    setStatus('loading');
    try {
      const result = await signInWithGoogle();
      const nextProfile = profileFromUser(result.user);
      setUser(result.user);
      setProfile(nextProfile);
      writeCachedProfile(nextProfile);
      window.localStorage.removeItem(AUTH_LOGOUT_KEY);
      setStatus('authenticated');
    } catch (err) {
      setStatus(profile ? 'restoring' : 'signed-out');
      setNotice(getFirebaseAuthMessage(err, currentHost()));
    }
  }

  async function signOutUser() {
    setNotice('');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTH_LOGOUT_KEY, '1');
      writeCachedProfile(null);
    }
    setUser(null);
    setProfile(null);
    setLocalGuestId(null);
    setStatus('signed-out');

    try {
      await signOutFirebase();
      setNotice('Signed out. This browser will show a profile again only after sign-in.');
    } catch {
      setNotice('Signed out locally. This browser will show a profile again only after sign-in.');
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      userId: user?.uid || localGuestId || (status === 'restoring' ? profile?.uid || null : null),
      status,
      notice,
      signInAsGuest,
      signInGoogle,
      signOutUser,
      clearNotice: () => setNotice(''),
    }),
    [localGuestId, notice, profile, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return value;
}
