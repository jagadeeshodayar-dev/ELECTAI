import { NextRequest, NextResponse } from 'next/server';
import { SpeechClient } from '@google-cloud/speech';
import { hasCompleteAddressSignal, normalizeSpokenAddress } from '@/lib/address-utils';
import { assertRateLimit } from '@/lib/server/rate-limit';

let speechClient: SpeechClient | null = null;

function getSpeechClient() {
  if (!speechClient) {
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    speechClient = credentialsJson
      ? new SpeechClient({ credentials: JSON.parse(credentialsJson) })
      : new SpeechClient();
  }
  return speechClient;
}

function getEncoding(contentType: string) {
  if (contentType.includes('audio/webm')) return 'WEBM_OPUS';
  if (contentType.includes('audio/ogg')) return 'OGG_OPUS';
  if (contentType.includes('audio/wav')) return 'LINEAR16';
  return 'WEBM_OPUS';
}

async function recognizeWithApiKey(audio: Buffer, contentType: string) {
  const apiKey = process.env.SPEECH_TO_TEXT_API;
  if (!apiKey) return null;

  const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio: { content: audio.toString('base64') },
      config: {
        encoding: getEncoding(contentType),
        languageCode: 'en-US',
        model: 'latest_short',
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Speech transcription is temporarily offline.');
  }

  return payload.results?.map((result: any) => result.alternatives?.[0]?.transcript).filter(Boolean).join(' ') || '';
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    assertRateLimit(`speech:${ip}`, 12);

    const audio = Buffer.from(await request.arrayBuffer());
    if (!audio.length || audio.length > 4_000_000) {
      return NextResponse.json({ error: 'Audio must be under 4 MB.' }, { status: 400 });
    }

    const contentType = request.headers.get('content-type') || 'audio/webm';

    const apiKeyTranscript = await recognizeWithApiKey(audio, contentType);
    if (apiKeyTranscript !== null) {
      const normalizedAddress = normalizeSpokenAddress(apiKeyTranscript);
      return NextResponse.json({
        transcript: apiKeyTranscript,
        normalizedAddress,
        needsMoreDetail: !hasCompleteAddressSignal(normalizedAddress),
      });
    }

    const [response] = await getSpeechClient().recognize({
      audio: { content: audio.toString('base64') },
      config: {
        encoding: getEncoding(contentType) as any,
        languageCode: 'en-US',
        model: 'latest_short',
      },
    });

    const transcript = response.results?.map((result) => result.alternatives?.[0]?.transcript).filter(Boolean).join(' ') || '';
    const normalizedAddress = normalizeSpokenAddress(transcript);
    return NextResponse.json({
      transcript,
      normalizedAddress,
      needsMoreDetail: !hasCompleteAddressSignal(normalizedAddress),
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : '';
    const message = details.includes('Could not load the default credentials')
      ? 'Speech-to-Text needs GOOGLE_APPLICATION_CREDENTIALS_JSON, GOOGLE_APPLICATION_CREDENTIALS, or SPEECH_TO_TEXT_API on the server.'
      : details || 'Speech transcription is temporarily offline.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
