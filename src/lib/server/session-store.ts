import 'server-only';
import { randomUUID } from 'crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SupportedCountry, UserSession } from '@/types';

const memorySessions = new Map<string, UserSession>();
const memoryFeedback = new Map<string, FeedbackRecord>();

export type FeedbackInput = {
  rating: number;
  category: 'missing-info' | 'wrong-answer' | 'hard-to-use' | 'feature-request' | 'other';
  message: string;
  country: SupportedCountry;
  userId: string | null;
  sessionId: string | null;
  pageHost: string | null;
  createdAt: number;
};

export type FeedbackRecord = FeedbackInput & {
  id: string;
};

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

export async function saveFeedback(input: FeedbackInput): Promise<FeedbackRecord> {
  const feedback = {
    id: randomUUID(),
    ...input,
  };

  memoryFeedback.set(feedback.id, feedback);

  try {
    await getAdminDb().collection('feedback').doc(feedback.id).set(feedback, { merge: true });
  } catch {
    // Keep feedback submission usable in local development when Firebase Admin is not configured.
  }

  return feedback;
}

export function redactSessionForClient(session: UserSession): UserSession {
  const { rawPayload: _rawPayload, ...safeElectionData } = session.electionData;
  return {
    ...session,
    electionData: safeElectionData,
  };
}
