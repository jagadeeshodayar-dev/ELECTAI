# Firebase Auth Setup For Cloud Run

The old hardcoded Firebase web config has been removed from app code. Auth is now loaded at runtime from Cloud Run environment variables through `/api/firebase-config`.

This matters because Cloud Run env vars are runtime values, while `NEXT_PUBLIC_*` variables are normally baked into the Next.js client bundle at build time.

## 1. Create Or Select Firebase Project

Firebase Console:

1. Open Project settings.
2. Add or open a Web app.
3. Copy the Firebase SDK config values.

## 2. Set Local Env

Create `.env.local` in the repo root:

```bash
FIREBASE_WEB_API_KEY=""
FIREBASE_AUTH_DOMAIN=""
FIREBASE_PROJECT_ID=""
FIREBASE_APP_ID=""
FIREBASE_MESSAGING_SENDER_ID=""
FIREBASE_STORAGE_BUCKET=""
FIREBASE_MEASUREMENT_ID=""
```

Required:

- `FIREBASE_WEB_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_APP_ID`

Optional:

- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MEASUREMENT_ID`

Restart `npm run dev` after changing env vars.

## 3. Deploy To Cloud Run

The deploy script reads `.env` and `.env.local`, uploads server secrets to Secret Manager, and sets Firebase web config as Cloud Run runtime env vars:

```powershell
npm run deploy:cloudrun -- -ProjectId "your-google-cloud-project-id" -Region "us-central1" -ServiceName "electai"
```

After deploy, the script prints the Cloud Run URL and the exact domain to add in Firebase Auth.

## 4. Enable Auth Providers

Firebase Console > Authentication > Sign-in method:

- Enable Google.
- Enable Anonymous if you want the `Guest` button to create Firebase anonymous users.

## 5. Add Authorized Domains

Firebase Console > Authentication > Settings > Authorized domains:

Add each host without protocol, path, or port:

```text
localhost
127.0.0.1
your-cloud-run-service-hash-region.a.run.app
your-custom-domain.com
```

For a Cloud Run URL like:

```text
https://electai-abc123-uc.a.run.app
```

Add only:

```text
electai-abc123-uc.a.run.app
```

## 6. Verify

1. Open the Cloud Run URL.
2. If the app says Firebase env is missing, check Cloud Run service env vars and redeploy.
3. Click `Google`.
4. If you see `auth/unauthorized-domain`, copy the current host from the app warning into Firebase Authorized domains.
5. Click `Guest`.
6. If Guest says the provider is disabled, enable Anonymous in Firebase Sign-in method.

The app falls back to local guest mode so the election workflow still works while Firebase is being configured.
