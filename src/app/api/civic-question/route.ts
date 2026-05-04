import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { answerCivicQuestion } from '@/lib/server/civic-qa';
import { assertRateLimit } from '@/lib/server/rate-limit';

const CivicQuestionSchema = z.object({
  question: z.string().min(1).max(500),
  country: z.enum(['IN', 'US']).default('IN'),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    assertRateLimit(`civic-question:${ip}`, 50);

    const body = CivicQuestionSchema.parse(await request.json());
    return NextResponse.json(answerCivicQuestion(body.question, body.country));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to answer this civic question.';
    return NextResponse.json({ error: message }, { status: message.includes('Too many') ? 429 : 400 });
  }
}
