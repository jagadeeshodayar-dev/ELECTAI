# Local Troubleshooting

Use this when the app loads but sign-in, address lookup, voice input, or production builds are confusing.

## Firebase Auth Warning

`auth/unauthorized-domain` means Firebase Authentication does not trust the browser host you opened the app from. It is not a Next.js crash.

Fix it in Firebase Console:

1. Open Firebase Console > Authentication > Settings > Authorized domains.
2. Add the exact host shown in the app warning.
3. For local development, add `localhost`.
4. If you open the app as `http://127.0.0.1:3000`, also add `127.0.0.1`.
5. For deployment, add only the host name, without `https://`, paths, or ports. Example: `electai-abc123.run.app`.

Firebase projects created after April 28, 2025 may not include `localhost` by default, so add it manually for local development.

## Enable Auth Providers

Open Firebase Console > Authentication > Sign-in method, then enable:

- Google
- Anonymous

The app tries Firebase Anonymous Auth when you click `Guest`. If Firebase Auth is still blocked or Anonymous is disabled, it falls back to a local guest id so the MVP can continue.

## Local Environment

Keep secrets server-side. Prefer `.env.local` for local development:

```bash
FIREBASE_WEB_API_KEY="..."
FIREBASE_AUTH_DOMAIN="..."
FIREBASE_PROJECT_ID="..."
FIREBASE_APP_ID="..."
GEMINI_API_KEY="..."
GOOGLE_CIVIC_API_KEY="..."
GOOGLE_MAPS_API_KEY="..."
SPEECH_TO_TEXT_API="..."
GEMINI_MODEL="gemini-2.5-flash"
APP_URL="http://localhost:3000"
```

The code still reads `VITE_GOOGLE_CIVIC_API_KEY` as a legacy fallback, but new setup should use `GOOGLE_CIVIC_API_KEY`.

Do not use `NEXT_PUBLIC_` for Civic, Speech, Gemini, or service-account keys.

## Google Cloud API Checklist

Enable these APIs in the Google Cloud project that owns the keys:

- Geocoding API or Maps API for India address normalization
- Civic Information API for the U.S. provider
- Gemini API access for `GEMINI_API_KEY`
- Speech-to-Text API for `SPEECH_TO_TEXT_API` or `GOOGLE_APPLICATION_CREDENTIALS_JSON`

For server-side API keys, use API restrictions, not HTTP referrer restrictions. HTTP referrer restrictions are for browser keys and can break backend calls.

## Verify The Codebase

Run these from the repo root:

```powershell
npm install
npm run lint
npm test
npm run build
npm run dev
```

In this Codex sandbox, `npm test` and `npm run build` may need permission because Vitest and Next spawn helper processes. On a normal local terminal they should run directly.

## Common Error Map

- `Firebase Auth is not configured for this Cloud Run service.`: add `FIREBASE_WEB_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, and `FIREBASE_APP_ID` to `.env.local` or Cloud Run env vars, then restart or redeploy.
- `GOOGLE_CIVIC_API_KEY is not configured.`: add `GOOGLE_CIVIC_API_KEY` to `.env.local`, or use India mode while you configure U.S. Civic.
- `API key not valid`: enable the API for that key's Google Cloud project.
- `referer` or `Referer` Civic error: create a separate server key without HTTP referrer restrictions.
- `Speech-to-Text needs...`: voice input is optional; add `SPEECH_TO_TEXT_API` or `GOOGLE_APPLICATION_CREDENTIALS_JSON` to enable server transcription.
- `Session expired`: restart with a complete address. Local memory sessions disappear when the dev server restarts unless Firestore Admin credentials are configured.
