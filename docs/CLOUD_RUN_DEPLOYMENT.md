# Cloud Run Deployment

This project is ready to deploy as a containerized Next.js service on Google Cloud Run.

## Required Google Cloud Values

- `ProjectId`: Google Cloud project id.
- `Region`: Cloud Run region, for example `us-central1`.
- `ServiceName`: Cloud Run service name, default `electai`.

## Required Runtime Secrets

Set these in `.env` locally before running the script, or export them in your shell:

```bash
FIREBASE_WEB_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_APP_ID=
GEMINI_API_KEY=
GOOGLE_MAPS_API_KEY=
```

Firebase values are public web-app identifiers, but they must match the Firebase project that owns Authentication. The script sets them as Cloud Run runtime env vars and the app serves them through `/api/firebase-config`.

Optional:

```bash
GOOGLE_CIVIC_API_KEY=
GOOGLE_GEOCODING_API_KEY=
SPEECH_TO_TEXT_API=
GOOGLE_APPLICATION_CREDENTIALS_JSON=
FIREBASE_SERVICE_ACCOUNT_JSON=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MEASUREMENT_ID=
GEMINI_MODEL=gemini-2.5-flash
FIRESTORE_DATABASE_ID=(default)
```

`SPEECH_TO_TEXT_API` can be replaced by `GOOGLE_APPLICATION_CREDENTIALS_JSON` if you prefer service-account auth for Speech-to-Text. `GOOGLE_CIVIC_API_KEY` is only needed for the U.S. provider; India mode uses Google address services and official Election Commission of India resource links.

## Deploy From Windows PowerShell

Install and sign in to the Google Cloud CLI first:

```powershell
gcloud auth login
gcloud auth application-default login
```

Then deploy:

```powershell
npm run deploy:cloudrun -- -ProjectId "your-project-id" -Region "us-central1" -ServiceName "electai"
```

The script:

- enables required Google Cloud APIs,
- uploads API keys to Secret Manager,
- grants Cloud Run access to those secrets,
- grants Firestore access to the runtime service account,
- builds from the local source using Cloud Build,
- deploys the service to Cloud Run.

## After Deploying

Add the Cloud Run URL domain to Firebase Authentication authorized domains. Use only the host, not `https://` and not any path:

Firebase Console > Authentication > Settings > Authorized domains.

Example:

```text
electai-abc123-uc.a.run.app
```

If Firestore rejects writes, confirm the Cloud Run runtime service account has `roles/datastore.user`.

If auth is still blocked, open the deployed app and copy the `Current host` value from the Firebase warning into Authorized domains.
