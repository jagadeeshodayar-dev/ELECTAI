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

function indiaGuidance(session: UserSession): GuidanceResponse {
  const resources = session.electionData.officialResources;
  const voterPortal = resources.votingLocationFinderUrl !== MISSING ? resources.votingLocationFinderUrl : 'https://voters.eci.gov.in/';
  const voterSearch = resources.electionRegistrationConfirmationUrl !== MISSING ? resources.electionRegistrationConfirmationUrl : voterPortal;
  const candidatePortal = resources.ballotInfoUrl !== MISSING ? resources.ballotInfoUrl : 'https://affidavit.eci.gov.in/';
  const schedulePortal = resources.electionInfoUrl !== MISSING ? resources.electionInfoUrl : 'https://www.eci.gov.in/';

  return {
    stepInstructions: [
      `Step ${session.currentStep} of 5: Use the official India voter services for the next lookup.`,
      'Your address was accepted for the India workflow.',
      'Polling booth details require an ECI voter search using EPIC, mobile, or voter details.',
      'Candidate affidavits appear after nominations are filed for the election.',
      `Official source: ${resources.electionAuthorityName}.`,
    ],
    timelineSummary: `Election dates are published by ECI and state election offices. Check the current schedule on ${schedulePortal}`,
    pollingLocationDetails: `Find your polling booth on the ECI voter services portal: ${voterPortal}`,
    candidateOverview: `Use the ECI Candidate Affidavit portal after selecting the election and constituency: ${candidatePortal}`,
    nextConcreteAction: `Open ECI voter search and verify your voter record or polling station: ${voterSearch}`,
    transparencyNote:
      'India mode uses Google for address normalization and official ECI services for voter actions. It does not infer polling booths, dates, or candidates from the typed address.',
  };
}

function fallbackGuidance(session: UserSession): GuidanceResponse {
  if (session.country === 'IN') {
    return indiaGuidance(session);
  }

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
    transparencyNote: `Election facts are from ${session.electionData.dataProvider}. Pending fields are not inferred.`,
  };
}

export async function generateGuidance(session: UserSession): Promise<GuidanceResponse> {
  if (session.country === 'IN') {
    return indiaGuidance(session);
  }

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
