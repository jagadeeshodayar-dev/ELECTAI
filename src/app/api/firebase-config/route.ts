import { NextResponse } from 'next/server';

const FIREBASE_ENV = {
  apiKey: ['FIREBASE_WEB_API_KEY', 'NEXT_PUBLIC_FIREBASE_API_KEY'],
  authDomain: ['FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'],
  projectId: ['FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'],
  appId: ['FIREBASE_APP_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID'],
  messagingSenderId: ['FIREBASE_MESSAGING_SENDER_ID', 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'],
  storageBucket: ['FIREBASE_STORAGE_BUCKET', 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'],
  measurementId: ['FIREBASE_MEASUREMENT_ID', 'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID'],
} as const;

const REQUIRED_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;

function readEnv(aliases: readonly string[]) {
  for (const name of aliases) {
    const value = process.env[name];
    if (value) return value;
  }

  return '';
}

export function GET() {
  const config = {
    apiKey: readEnv(FIREBASE_ENV.apiKey),
    authDomain: readEnv(FIREBASE_ENV.authDomain),
    projectId: readEnv(FIREBASE_ENV.projectId),
    appId: readEnv(FIREBASE_ENV.appId),
    messagingSenderId: readEnv(FIREBASE_ENV.messagingSenderId),
    storageBucket: readEnv(FIREBASE_ENV.storageBucket),
    measurementId: readEnv(FIREBASE_ENV.measurementId),
  };

  const missing = REQUIRED_KEYS.filter((key) => !config[key]).map((key) => FIREBASE_ENV[key][0]);

  if (missing.length) {
    return NextResponse.json({ configured: false, missing }, { status: 503 });
  }

  return NextResponse.json({
    configured: true,
    config,
  });
}
