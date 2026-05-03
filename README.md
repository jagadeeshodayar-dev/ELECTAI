# ELECTAI — Election Process Assistant

ELECTAI is an MVP civic-tech assistant for the prompt: **help users understand the election process, timelines, and steps in an interactive and easy-to-follow way.**

## Chosen Vertical

Voter readiness for first-time, busy, or low-literacy voters. The assistant accepts an address, retrieves verified election data from Google Civic Information API, and turns that data into five simple steps:

1. Understand the election
2. Know when to vote
3. Know where to vote
4. Understand candidates
5. Take the next action

## Approach And Logic

The product is intentionally not a general chatbot. It is a structured assistant with a fixed workflow, controlled prompts, and verified data boundaries.

- User input is validated and sanitized on the backend.
- Spoken addresses are cleaned up before lookup, and incomplete transcripts are stopped with a clear city/state/ZIP prompt.
- Election facts come only from Google Civic Information API.
- Official election office links are extracted from Civic `state.electionAdministrationBody`.
- Missing fields are displayed as: `This information is not available.`
- Gemini receives a structured session object, not raw user input.
- Gemini does not receive the user's address or the raw Civic payload.
- Firestore stores the session for continuity.
- Firebase Auth supports Google sign-in and guest mode.
- Google Speech-to-Text powers voice address entry for accessibility.

## How The Solution Works

`POST /api/assistant`

Request:

```json
{ "address": "1600 Pennsylvania Ave NW, Washington, DC", "userId": "optional" }
```

Response:

```json
{
  "session": {
    "id": "uuid",
    "sanitizedAddress": "validated address",
    "currentStep": 1,
    "electionData": {},
    "decisionFlags": {}
  },
  "guidance": {
    "stepInstructions": [],
    "timelineSummary": "",
    "pollingLocationDetails": "",
    "candidateOverview": "",
    "nextConcreteAction": "",
    "transparencyNote": ""
  }
}
```

`POST /api/guidance` advances the five-step assistant by session id and step. The server reloads the saved session instead of trusting a client-supplied election payload.

`POST /api/speech/transcribe` accepts short `audio/webm` clips and returns the raw transcript, a normalized address string, and whether the address still needs city/state/ZIP detail.

## Firestore Schema

Collection: `sessions`

```ts
{
  id: string;
  sanitizedAddress: string;
  electionData: {
    election: { id: string; name: string; electionDay: string; ocdDivisionId: string };
    pollingLocations: PollingLocation[];
    contests: Contest[];
    rawPayload: unknown;
    normalizedInput: CivicAddress;
    officialResources: {
      electionAuthorityName: string;
      electionInfoUrl: string;
      votingLocationFinderUrl: string;
      ballotInfoUrl: string;
      electionRegistrationUrl: string;
      electionRegistrationConfirmationUrl: string;
      absenteeVotingInfoUrl: string;
    };
  };
  decisionFlags: {
    hasUpcomingElection: boolean;
    hasPollingLocation: boolean;
    hasCandidateData: boolean;
  };
  currentStep: number;
  createdAt: number;
  updatedAt: number;
  userId?: string | null;
}
```

## Google Services Used

- Google Civic Information API: verified voter and contest data.
- Google Geocoding API, optional: server-side address cleanup for spoken or partial addresses before Civic lookup.
- Google Maps and Google Calendar links: voter action shortcuts for polling locations and election dates.
- Gemini API: plain-language guidance from verified structured data only.
- Firestore: session persistence.
- Firebase Authentication: Google sign-in and anonymous guest mode.
- Google Speech-to-Text: centered mic input for accessible address entry.
- Google Cloud Run: recommended deployment target for the Next.js service.
- Secret Manager: recommended production source for runtime secrets.

## Environment Variables

Use `.env.local` for local secrets. Do not expose keys with `NEXT_PUBLIC_`.

```bash
GEMINI_API_KEY=
GOOGLE_CIVIC_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
FIRESTORE_DATABASE_ID=(default)
FIREBASE_SERVICE_ACCOUNT_JSON=
GOOGLE_APPLICATION_CREDENTIALS_JSON=
SPEECH_TO_TEXT_API=
GOOGLE_GEOCODING_API_KEY=
GOOGLE_MAPS_API_KEY=
```

The code still reads the older `VITE_GOOGLE_CIVIC_API_KEY` as a local fallback so existing uncommitted env files keep working, but new deployments should use `GOOGLE_CIVIC_API_KEY`.

For local development, create separate Google API keys:

- `GOOGLE_CIVIC_API_KEY`: server-side key for Civic Information API. Do not restrict it by HTTP referrer; use API restriction to Civic Information API and production server restrictions where applicable.
- `SPEECH_TO_TEXT_API`: server-side key for Speech-to-Text API, or use `GOOGLE_APPLICATION_CREDENTIALS_JSON` with a service account.
- `GOOGLE_GEOCODING_API_KEY`: optional server-side key for Geocoding API. Use API restriction to Geocoding API. This helps recover from speech transcripts that have enough address detail but need canonical formatting.

Firebase Auth setup:

- Add `localhost`, `127.0.0.1`, and your deployed domain in Firebase Console > Authentication > Settings > Authorized domains.
- Enable Google and Anonymous providers in Firebase Console > Authentication > Sign-in method.

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Cloud Run Deployment

This repo includes a Cloud Run Dockerfile and a Secret Manager based deploy script.

```powershell
npm run deploy:cloudrun -- -ProjectId "your-project-id" -Region "us-central1" -ServiceName "electai"
```

See [docs/CLOUD_RUN_DEPLOYMENT.md](docs/CLOUD_RUN_DEPLOYMENT.md).

## Testing Plan

See [docs/FEATURE_TEST_SECURITY_MATRIX.md](docs/FEATURE_TEST_SECURITY_MATRIX.md) for feature-by-feature test cases and security checks.

## Assumptions

- Google Civic API may not return data for every address or election cycle.
- If local Firestore admin credentials are absent, the assistant still returns guidance; Cloud Run should provide credentials in production.
- Voice input is optional and may depend on microphone permission and browser support.

## Workflow Diagram

See [docs/MVP_WORKFLOW.md](docs/MVP_WORKFLOW.md).
