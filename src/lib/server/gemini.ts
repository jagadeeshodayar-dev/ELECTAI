import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { GuidanceResponse, MISSING, UserSession } from '@/types';
import { getRequiredEnv } from './env';
import { buildGuidancePrompt } from './prompt';

let ai: GoogleGenAI | null = null;

const GuidanceResponseSchema = z.object({
  stepInstructions: z.array(z.string().min(1)).min(1).max(6),
  timelineSummary: z.string().min(1),
  pollingLocationDetails: z.string().min(1),
  candidateOverview: z.string().min(1),
  nextConcreteAction: z.string().min(1),
  transparencyNote: z.string().min(1),
});

function getGeminiClient() {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: getRequiredEnv('GEMINI_API_KEY') });
  }
  return ai;
}

function fallbackGuidance(session: UserSession): GuidanceResponse {
  const location = session.electionData.pollingLocations[0];
  const contestCount = session.electionData.contests.length;
  const resources = session.electionData.officialResources;
  const officialAction =
    resources.electionInfoUrl !== MISSING
      ? `Check the official election office page: ${resources.electionInfoUrl}`
      : 'Continue through the five steps and use only the verified details shown here.';

  return {
    stepInstructions: [
      `Step ${session.currentStep} of 5: Review only the verified information shown on this page.`,
      session.decisionFlags.hasUpcomingElection ? 'An upcoming election was found.' : MISSING,
      session.decisionFlags.hasPollingLocation ? 'A polling location was found.' : MISSING,
      session.decisionFlags.hasCandidateData ? 'Candidate information was found.' : MISSING,
      resources.electionAuthorityName !== MISSING ? `Official source: ${resources.electionAuthorityName}.` : MISSING,
    ],
    timelineSummary: session.electionData.election.electionDay,
    pollingLocationDetails: location
      ? `${location.address.locationName}, ${location.address.line1}, ${location.address.city}, ${location.address.state} ${location.address.zip}. Hours: ${location.pollingHours}`
      : MISSING,
    candidateOverview: contestCount > 0 ? `${contestCount} contest(s) are listed in the verified data.` : MISSING,
    nextConcreteAction: officialAction,
    transparencyNote: 'Election facts are from the Google Civic Information API. Missing fields are not inferred.',
  };
}

export async function generateGuidance(session: UserSession): Promise<GuidanceResponse> {
  try {
    const response = await getGeminiClient().models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: buildGuidancePrompt(session),
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim();
    if (!text) return fallbackGuidance(session);
    return GuidanceResponseSchema.parse(JSON.parse(text));
  } catch {
    return fallbackGuidance(session);
  }
}
