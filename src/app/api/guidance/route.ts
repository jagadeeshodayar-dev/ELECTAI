import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateGuidance } from '@/lib/server/gemini';
import { assertRateLimit } from '@/lib/server/rate-limit';
import { getSession, redactSessionForClient, saveSession } from '@/lib/server/session-store';

const GuidanceRequestSchema = z.object({
  sessionId: z.string().min(1).optional(),
  currentStep: z.number().int().min(1).max(5).optional(),
  session: z
    .object({
      id: z.string().min(1),
      currentStep: z.number().int().min(1).max(5),
    })
    .passthrough()
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    assertRateLimit(`guidance:${ip}`, 40);

    const body = GuidanceRequestSchema.parse(await request.json());
    const sessionId = body.sessionId || body.session?.id;
    const currentStep = body.currentStep || body.session?.currentStep;
    if (!sessionId || !currentStep) {
      return NextResponse.json({ error: 'Session id and step are required.' }, { status: 400 });
    }

    const savedSession = await getSession(sessionId);
    if (!savedSession) {
      return NextResponse.json({ error: 'Session expired. Enter your address again to reload verified election data.' }, { status: 404 });
    }

    const updatedSession = { ...savedSession, currentStep, updatedAt: Date.now() };
    await saveSession(updatedSession);
    const guidance = await generateGuidance(updatedSession);
    return NextResponse.json({ session: redactSessionForClient(updatedSession), guidance });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate guidance.';
    return NextResponse.json({ error: message }, { status: message.includes('Too many') ? 429 : 400 });
  }
}
