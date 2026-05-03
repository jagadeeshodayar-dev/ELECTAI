import 'server-only';
import { hasCompleteAddressSignal, normalizeSpokenAddress } from '@/lib/address-utils';
import { sanitizeAddress } from './validation';

const GEOCODE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

export const COMPLETE_ADDRESS_REQUIRED =
  'Enter a complete U.S. voting address with street, city, state, and ZIP code. Voice input can mishear city names, so please review the address before starting.';

export type AddressResolution = {
  civicAddress: string;
  displayAddress: string;
  source: 'input' | 'google-geocoding';
};

type GeocodeResult = {
  formatted_address?: string;
  types?: string[];
};

type GeocodePayload = {
  status?: string;
  results?: GeocodeResult[];
};

function getGeocodingApiKey() {
  return process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
}

async function geocodeAddress(address: string) {
  const key = getGeocodingApiKey();
  if (!key) return null;

  const url = new URL(GEOCODE_ENDPOINT);
  url.searchParams.set('address', address);
  url.searchParams.set('components', 'country:US');
  url.searchParams.set('language', 'en');
  url.searchParams.set('key', key);

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  const payload = (await response.json()) as GeocodePayload;
  if (!response.ok || payload.status !== 'OK') return null;

  const result =
    payload.results?.find((item) => item.types?.some((type) => ['street_address', 'premise', 'subpremise'].includes(type))) ||
    payload.results?.[0];

  const formattedAddress = result?.formatted_address;
  return formattedAddress && hasCompleteAddressSignal(formattedAddress) ? formattedAddress : null;
}

export async function resolveAddressForCivic(input: unknown): Promise<AddressResolution> {
  const spoken = normalizeSpokenAddress(typeof input === 'string' ? input : '');
  const sanitized = sanitizeAddress(spoken);

  if (hasCompleteAddressSignal(sanitized)) {
    return {
      civicAddress: sanitized,
      displayAddress: sanitized,
      source: 'input',
    };
  }

  const geocoded = await geocodeAddress(sanitized);
  if (geocoded) {
    return {
      civicAddress: geocoded,
      displayAddress: geocoded,
      source: 'google-geocoding',
    };
  }

  throw new Error(COMPLETE_ADDRESS_REQUIRED);
}

export function toFriendlyCivicAddressError(message: string) {
  const lower = message.toLowerCase();
  if (
    lower.includes('parse address') ||
    lower.includes('address could not be found') ||
    lower.includes('failed to parse') ||
    lower.includes('no address')
  ) {
    return COMPLETE_ADDRESS_REQUIRED;
  }
  return message;
}
