import 'server-only';
import { toFriendlyCivicAddressError } from './address';
import { getCivicApiKey } from './env';

const CIVIC_ENDPOINT = 'https://www.googleapis.com/civicinfo/v2/voterinfo';

export async function fetchVoterInfo(sanitizedAddress: string) {
  const apiKey = getCivicApiKey();
  if (!apiKey) {
    throw new Error('GOOGLE_CIVIC_API_KEY is not configured.');
  }

  const url = new URL(CIVIC_ENDPOINT);
  url.searchParams.set('address', sanitizedAddress);
  url.searchParams.set('key', apiKey);

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const payload = await response.json();

  if (!response.ok) {
    const message = toFriendlyCivicAddressError(payload?.error?.message || 'Failed to fetch verified election data.');
    if (message.includes('referer') || message.includes('Referer')) {
      throw new Error(
        'Google Civic API key is restricted to HTTP referrers. Create a separate server key for GOOGLE_CIVIC_API_KEY with API restriction set to Civic Information API, and do not use website/referrer restrictions for backend calls.',
      );
    }
    if (message.includes('API key not valid')) {
      throw new Error('GOOGLE_CIVIC_API_KEY is invalid or not enabled for the Google Civic Information API.');
    }
    throw new Error(message);
  }

  return payload;
}
