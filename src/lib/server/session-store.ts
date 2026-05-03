import 'server-only';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { UserSession } from '@/types';

const memorySessions = new Map<string, UserSession>();

function getAdminDb() {
  if (!getApps().length) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
    } else {
      initializeApp();
    }
  }
  return getFirestore(process.env.FIRESTORE_DATABASE_ID || '(default)');
}

export async function saveSession(session: UserSession) {
  memorySessions.set(session.id, session);

  try {
    await getAdminDb().collection('sessions').doc(session.id).set(session, { merge: true });
  } catch {
    // The UI can still respond if local credentials are absent during development.
  }
}

export async function getSession(sessionId: string) {
  const cached = memorySessions.get(sessionId);
  if (cached) return cached;

  try {
    const snapshot = await getAdminDb().collection('sessions').doc(sessionId).get();
    if (!snapshot.exists) return null;
    const session = snapshot.data() as UserSession;
    memorySessions.set(session.id, session);
    return session;
  } catch {
    return null;
  }
}

export function redactSessionForClient(session: UserSession): UserSession {
  const { rawPayload: _rawPayload, ...safeElectionData } = session.electionData;
  return {
    ...session,
    electionData: safeElectionData,
  };
}
