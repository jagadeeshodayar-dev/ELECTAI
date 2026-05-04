# Global Provider Strategy

ELECTAI is now structured as an India-first, global-ready election assistant. The app should never pretend that one country has the same election-data API coverage as another country.

## Current Providers

### India

Status: scaffolded as the default country.

Used now:

- Google Geocoding or Google Maps API key for India address normalization.
- Official Election Commission of India resource links for voter services, voter search, candidate affidavits, and election information.
- Gemini for plain-language guidance from structured provider data only.

Not assumed:

- Polling station lookup by only a typed address.
- Candidate list lookup by only a typed address.
- Election date lookup by only a typed address.

Those require an approved India election-data API, a licensed dataset, or a compliant integration with an official ECI/ECINET service.

### United States

Status: retained as a secondary provider.

Used now:

- Google Civic Information API `voterinfo`.
- Optional Google Geocoding for address cleanup.
- Gemini for plain-language guidance from structured provider data only.

## APIs To Ask For Before Production

Ask the platform owner for:

1. `GEMINI_API_KEY`
2. `GOOGLE_MAPS_API_KEY` or `GOOGLE_GEOCODING_API_KEY`
3. Firebase project config and Firebase Auth provider choices
4. Firebase Admin service account JSON for server-side Firestore writes
5. `SPEECH_TO_TEXT_API` or `GOOGLE_APPLICATION_CREDENTIALS_JSON`
6. Any official or licensed India election-data API access, especially for polling station, electoral roll search, candidate, schedule, and results data

## India Product Boundaries

Until official India data access is configured:

- Show official ECI links and explain pending fields clearly.
- Use Google only for address normalization and maps-style actions.
- Do not infer a user's polling booth, constituency, candidate list, eligibility, ID rules, or deadlines.
- Do not scrape private or captcha-protected voter services.

## Expansion Pattern

Add one provider per country:

```ts
type SupportedCountry = 'IN' | 'US';
```

Each provider should return the same `ExtractedElectionData` shape:

- `country`
- `dataProvider`
- `providerStatus`
- `providerNotes`
- `election`
- `officialResources`
- `pollingLocations`
- `contests`

This keeps the UI, Gemini prompt, persistence, and tests stable as more countries are added.
