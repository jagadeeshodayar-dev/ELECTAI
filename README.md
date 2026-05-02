# Election Assistant

A structured civic guidance system designed to help voters navigate upcoming elections with verified data and AI-powered step-by-step instructions.

## Architecture

- **Frontend:** React + Vite + Tailwind CSS + Lucide Icons + Motion (for animations)
- **Backend:** Node.js (Express) on Cloud Run
- **Database:** Firestore (stores user sessions)
- **Auth:** Firebase Authentication (Guest mode + Google Login)
- **AI:** Gemini 1.5 Flash (provides plain-language guidance)
- **Data:** Google Civic Information API

## Key Features

1. **Verified Data:** All election information is fetched directly from Google's Civic API. No hallucinations.
2. **5-Step Wizard:** Clear progress tracking through Election Info, Dates, Locations, Candidates, and Action Plan.
3. **AI Guide:** A dedicated sidebar providing context and encouragement at every step.
4. **Voice Input:** Use your voice to enter your address.
5. **Mobile Responsive:** Designed for all screen sizes.

## Local Setup

1. **Environment Variables:**
   - Copy `.env.example` to `.env`.
   - Add your `GEMINI_API_KEY`.
   - Add your `VITE_GOOGLE_CIVIC_API_KEY` (Get it from Google Cloud Console).

2. **Installation:**
   ```bash
   npm install
   ```

3. **Development:**
   ```bash
   npm run dev
   ```

4. **Production Build:**
   ```bash
   npm run build
   ```

## Security

- API keys are never exposed to the frontend.
- User input is sanitized and wrapped in controlled prompt templates for Gemini.
- Firestore rules enforce strict data validation and ownership.
