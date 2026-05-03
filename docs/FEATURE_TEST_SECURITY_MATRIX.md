# Feature Test And Security Matrix

Use this as the MVP review checklist. Each feature has product intent, test cases, and security checks.

## 1. Address Entry

Product intent: let users start with the least possible friction.

Test cases:
- Empty address blocks submission.
- Address under 5 characters blocks submission.
- Address over 200 characters is rejected by the API.
- Normal address creates a session and shows step 1.
- Ambiguous Civic API response returns a clear error, not invented data.
- Spoken phrases such as "number forty..." normalize street numbers without bypassing city/state/ZIP checks.

Security checks:
- Backend sanitizes before Civic API calls.
- Prompt-injection markers are stripped.
- Optional Google Geocoding runs server-side only and only before Civic lookup.
- Raw address is not included in Gemini prompt.
- API rate limit rejects abusive repeated requests.

## 2. Voice Input

Product intent: improve accessibility for users who struggle with typing.

Test cases:
- Mic button requests browser permission.
- Permission denial shows a readable error.
- Short `audio/webm` clip calls `/api/speech/transcribe`.
- Large audio payload is rejected.
- Transcript fills the address field without auto-submitting.
- Incomplete transcript shows a visible and screen-reader friendly prompt for city/state/ZIP.

Security checks:
- Audio endpoint is rate-limited.
- Audio payload capped at 4 MB.
- Speech-to-Text runs server-side with Google credentials.
- Transcript still goes through address validation.

## 3. Civic Data Fetch

Product intent: never hallucinate election facts.

Test cases:
- Valid Civic response extracts election name and date.
- Missing polling location renders `This information is not available.`
- Missing candidates renders `This information is not available.`
- Official election office links are extracted from Civic administration fields.
- Civic API failure returns a user-safe error.

Security checks:
- Civic API key is server-only.
- No `NEXT_PUBLIC_` or browser-exposed key is used.
- Request uses `encodeURIComponent` through `URLSearchParams`.
- No cached election data is reused for a different address.

## 4. Five-Step Assistant

Product intent: guide users through the process in a fixed, easy sequence.

Test cases:
- Progress starts at step 1.
- Continue increments one step only.
- Back decrements one step only.
- Step 5 disables further progress.
- Each step shows only verified extracted fields.

Security checks:
- Client cannot bypass the server prompt template.
- Guidance endpoint accepts session id and step, then reloads the saved server session.
- Missing facts are not replaced by common assumptions.

## 5. Gemini Guidance

Product intent: translate verified data into plain sixth-grade instructions.

Test cases:
- Prompt contains structured session object only.
- Prompt includes the exact no-inference rule.
- Prompt excludes both the user address and raw Civic payload.
- Response shape matches required JSON fields.
- Gemini failure returns deterministic fallback guidance.

Security checks:
- Temperature is low.
- Prompt explicitly bans invented legal, deadline, ID, location, and candidate facts.
- Output is treated as guidance, not as a source of election facts.

## 6. Firestore Session

Product intent: preserve session progress and support authenticated or guest users.

Test cases:
- Session document includes id, sanitized address, election data, flags, current step, timestamps.
- Guest user can create a session.
- Google-authenticated user can create a session.
- Local missing admin credentials does not break MVP response.

Security checks:
- Firestore rules default deny.
- Server writes use Admin credentials in production.
- Session owner fields are preserved.

## 7. Premium UI And Accessibility

Product intent: create a high-trust civic interface that feels restrained, legible, and fast.

Test cases:
- Tailwind classes render after production build.
- Gold appears only on actions, focus states, and key highlights.
- Body text remains white or soft white, not gold.
- Keyboard focus is visible on controls.
- Layout works at mobile and desktop widths.

Security checks:
- No sensitive values are rendered in UI.
- Error messages do not expose stack traces.
- External candidate links open with `rel="noreferrer"`.
