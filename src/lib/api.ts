import { VoterInfoResponse, UserSession } from '../types';

export async function getVoterInfo(address: string): Promise<VoterInfoResponse> {
  const response = await fetch(`/api/voter-info?address=${encodeURIComponent(address)}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch voter info');
  }
  return response.json();
}

export async function getGuidance(session: UserSession): Promise<{ summary: string; nextStep: string; alert?: string }> {
  const response = await fetch('/api/guidance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session }),
  });
  if (!response.ok) {
    throw new Error('Failed to get guidance');
  }
  return response.json();
}
