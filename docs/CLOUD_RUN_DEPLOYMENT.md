# Cloud Run Deployment

This project is ready to deploy as a containerized Next.js service on Google Cloud Run.

## Required Google Cloud Values

- `ProjectId`: Google Cloud project id.
- `Region`: Cloud Run region, for example `us-central1`.
- `ServiceName`: Cloud Run service name, default `electai`.

## Required Runtime Secrets

Set these in `.env` locally before running the script, or export them in your shell:

```bash
GEMINI_API_KEY=
GOOGLE_CIVIC_API_KEY=
SPEECH_TO_TEXT_API=
```

`SPEECH_TO_TEXT_API` can be replaced by `GOOGLE_APPLICATION_CREDENTIALS_JSON` if you prefer service-account auth for Speech-to-Text.

Optional:

```bash
GOOGLE_GEOCODING_API_KEY=
GOOGLE_MAPS_API_KEY=
FIREBASE_SERVICE_ACCOUNT_JSON=
GEMINI_MODEL=gemini-2.5-flash
FIRESTORE_DATABASE_ID=(default)
```

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

Add the Cloud Run URL domain to Firebase Authentication authorized domains:

Firebase Console > Authentication > Settings > Authorized domains.

If Firestore rejects writes, confirm the Cloud Run runtime service account has `roles/datastore.user`.
