import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertRateLimit } from '@/lib/server/rate-limit';
import { getLocationSuggestions } from '@/lib/server/location-suggestions';

const LocationSuggestionSchema = z.object({
  query: z.string().min(2).max(160),
  country: z.enum(['IN', 'US']).default('IN'),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    assertRateLimit(`location-suggest:${ip}`, 80);

    const body = LocationSuggestionSchema.parse(await request.json());
    return NextResponse.json(await getLocationSuggestions(body.query, body.country));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load location suggestions.';
    return NextResponse.json({ configured: false, suggestions: [], message }, { status: message.includes('Too many') ? 429 : 400 });
  }
}
