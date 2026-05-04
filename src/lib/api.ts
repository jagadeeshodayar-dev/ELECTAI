import {
  AssistantResponse,
  CivicQuestionResponse,
  FeedbackResponse,
  GuidanceResponse,
  LocationSuggestionResponse,
  SpeechTranscriptionResponse,
  SupportedCountry,
  UserSession,
} from '@/types';

export async function createAssistantSession(address: string, userId?: string | null, country: SupportedCountry = 'IN'): Promise<AssistantResponse> {
  const response = await fetch('/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, userId, country }),
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

export async function askCivicQuestion(question: string, country: SupportedCountry): Promise<CivicQuestionResponse> {
  const response = await fetch('/api/civic-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, country }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to answer civic question.');
  }
  return data;
}

export async function getLocationSuggestions(query: string, country: SupportedCountry): Promise<LocationSuggestionResponse> {
  const response = await fetch('/api/location/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, country }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Failed to load location suggestions.');
  }
  return data;
}

export async function submitFeedback(payload: {
  rating: number;
  category: 'missing-info' | 'wrong-answer' | 'hard-to-use' | 'feature-request' | 'other';
  message: string;
  country: SupportedCountry;
  userId?: string | null;
  sessionId?: string | null;
  pageHost?: string | null;
}): Promise<FeedbackResponse> {
  const response = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to save feedback.');
  }
  return data;
}
