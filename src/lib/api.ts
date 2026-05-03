import { AssistantResponse, GuidanceResponse, SpeechTranscriptionResponse, UserSession } from '@/types';

export async function createAssistantSession(address: string, userId?: string | null): Promise<AssistantResponse> {
  const response = await fetch('/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, userId }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch voter info.');
  }
  return data;
}

export async function getGuidance(session: UserSession): Promise<{ session: UserSession; guidance: GuidanceResponse }> {
  const response = await fetch('/api/guidance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: session.id, currentStep: session.currentStep }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to get guidance.');
  }
  return data;
}

export async function transcribeAddress(audio: Blob): Promise<SpeechTranscriptionResponse> {
  const response = await fetch('/api/speech/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': audio.type || 'audio/webm' },
    body: audio,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to transcribe audio.');
  }
  return {
    transcript: data.transcript || '',
    normalizedAddress: data.normalizedAddress || data.transcript || '',
    needsMoreDetail: Boolean(data.needsMoreDetail),
  };
}
