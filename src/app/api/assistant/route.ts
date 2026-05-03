import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { resolveAddressForCivic } from '@/lib/server/address';
import { fetchVoterInfo } from '@/lib/server/civic';
import { evaluateElectionData } from '@/lib/server/decision';
import { extractElectionData } from '@/lib/server/extract';
import { generateGuidance } from '@/lib/server/gemini';
import { assertRateLimit } from '@/lib/server/rate-limit';
import { redactSessionForClient, saveSession } from '@/lib/server/session-store';
import { UserSession } from '@/types';

const AssistantRequestSchema = z.object({
  address: z.string(),
  userId: z.string().max(128).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    assertRateLimit(ip);

    const body = AssistantRequestSchema.parse(await request.json());

    // MVP workflow in one secure server endpoint:
    // 1. normalize/sanitize the address before any downstream call,
    // 2. optionally resolve speech-like input with Google Geocoding,
    // 3. fetch only verified Google Civic data,
    // 4. extract known fields and mark missing fields explicitly,
    // 5. save a Firestore session,
    // 6. ask Gemini to explain only that structured session object.
    // The raw address is never placed in the Gemini prompt.
    const addressResolution = await resolveAddressForCivic(body.address);
    const civicPayload = await fetchVoterInfo(addressResolution.civicAddress);
    const electionData = extractElectionData(civicPayload);
    const decisionFlags = evaluateElectionData(electionData);
    const now = Date.now();

    const session: UserSession = {
      id: randomUUID(),
      sanitizedAddress: addressResolution.displayAddress,
      electionData,
      decisionFlags,
      currentStep: 1,
      createdAt: now,
      updatedAt: now,
      addressSource: addressResolution.source,
      userId: body.userId ?? null,
    };

    await saveSession(session);
    const guidance = await generateGuidance(session);

    return NextResponse.json({ session: redactSessionForClient(session), guidance });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to prepare election guidance.';
    return NextResponse.json({ error: message }, { status: message.includes('Too many') ? 429 : 400 });
  }
}
