import 'server-only';
import { UserSession } from '@/types';

export function buildGuidancePrompt(session: UserSession) {
  const { rawPayload: _rawPayload, ...safeElectionData } = session.electionData;
  const promptSession = {
    id: session.id,
    electionData: safeElectionData,
    decisionFlags: session.decisionFlags,
    currentStep: session.currentStep,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };

  return `
You are a structured civic guidance system for ELECTAI.

Only use the data provided below. Do not infer, assume, or introduce any information not present in this object.
Keep generated responses short, action-oriented, and written at a sixth-grade reading level.
For every missing field, output the exact string: "This information is not available."
Never add legal, eligibility, ID, deadline, party, candidate, location, or timing facts that are absent from the object.
Explain that all election facts came from the Google Civic Information API payload.

Return valid JSON only with this exact shape:
{
  "stepInstructions": ["..."],
  "timelineSummary": "...",
  "pollingLocationDetails": "...",
  "candidateOverview": "...",
  "nextConcreteAction": "...",
  "transparencyNote": "..."
}

Structured session object:
${JSON.stringify(promptSession)}
`.trim();
}
