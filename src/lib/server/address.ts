import 'server-only';
import { hasCompleteAddressSignal, normalizeSpokenAddress } from '@/lib/address-utils';
import { SupportedCountry } from '@/types';
import { sanitizeAddress } from './validation';

const GEOCODE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

export const COMPLETE_ADDRESS_REQUIRED =
  'Enter a complete voting address with locality, city, state, and postal code. Voice input can mishear place names, so please review the address before starting.';

const COUNTRY_ADDRESS_REQUIREMENTS: Record<SupportedCountry, string> = {
  IN: 'Enter a complete India voting address with locality, city, state, and 6-digit PIN code. Voice input can mishear place names, so please review the address before starting.',
  US: 'Enter a complete U.S. voting address with street, city, state, and ZIP code. Voice input can mishear city names, so please review the address before starting.',
};

export type AddressResolution = {
  civicAddress: string;
  displayAddress: string;
  country: SupportedCountry;
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

export function getCompleteAddressRequired(country: SupportedCountry) {
  return COUNTRY_ADDRESS_REQUIREMENTS[country];
}

async function geocodeAddress(address: string, country: SupportedCountry) {
  const key = getGeocodingApiKey();
  if (!key) return null;

  const url = new URL(GEOCODE_ENDPOINT);
  url.searchParams.set('address', address);
  url.searchParams.set('components', `country:${country}`);
  url.searchParams.set('language', 'en');
  url.searchParams.set('region', country.toLowerCase());
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
  return formattedAddress && hasCompleteAddressSignal(formattedAddress, country) ? formattedAddress : null;
}

export async function resolveAddressForCivic(input: unknown, country: SupportedCountry = 'IN'): Promise<AddressResolution> {
  const spoken = normalizeSpokenAddress(typeof input === 'string' ? input : '');
  const sanitized = sanitizeAddress(spoken);

  if (hasCompleteAddressSignal(sanitized, country)) {
    return {
      civicAddress: sanitized,
      displayAddress: sanitized,
      country,
      source: 'input',
    };
  }

  const geocoded = await geocodeAddress(sanitized, country);
  if (geocoded) {
    return {
      civicAddress: geocoded,
      displayAddress: geocoded,
      country,
      source: 'google-geocoding',
    };
  }

  throw new Error(getCompleteAddressRequired(country));
}

export function toFriendlyCivicAddressError(message: string, country: SupportedCountry = 'US') {
  const lower = message.toLowerCase();
  if (
    lower.includes('parse address') ||
    lower.includes('address could not be found') ||
    lower.includes('failed to parse') ||
    lower.includes('no address')
  ) {
    return getCompleteAddressRequired(country);
  }
  return message;
}
