import 'server-only';
import { UserSession } from '@/types';

export function buildGuidancePrompt(session: UserSession) {
  const { rawPayload: _rawPayload, normalizedInput: _normalizedInput, ...safeElectionData } = session.electionData;
  const promptSession = {
    id: session.id,
    country: session.country,
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
For every missing field, output the exact string: "Official data pending."
Never add legal, eligibility, ID, deadline, party, candidate, location, or timing facts that are absent from the object.
Explain that election facts came only from the configured provider shown in electionData.dataProvider.

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
