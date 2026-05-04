import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertRateLimit } from '@/lib/server/rate-limit';
import { saveFeedback } from '@/lib/server/session-store';

const FeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  category: z.enum(['missing-info', 'wrong-answer', 'hard-to-use', 'feature-request', 'other']),
  message: z.string().min(5).max(1200),
  country: z.enum(['IN', 'US']).default('IN'),
  userId: z.string().max(128).nullable().optional(),
  sessionId: z.string().max(128).nullable().optional(),
  pageHost: z.string().max(160).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    assertRateLimit(`feedback:${ip}`, 10);

    const body = FeedbackSchema.parse(await request.json());
    const feedback = await saveFeedback({
      ...body,
      userId: body.userId ?? null,
      sessionId: body.sessionId ?? null,
      pageHost: body.pageHost ?? null,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      id: feedback.id,
      saved: true,
      message: 'Feedback saved. Thank you for helping improve ELECTAI.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save feedback.';
    return NextResponse.json({ error: message }, { status: message.includes('Too many') ? 429 : 400 });
  }
}
