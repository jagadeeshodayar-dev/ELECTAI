import 'server-only';
import { LocationSuggestion, LocationSuggestionResponse, SupportedCountry } from '@/types';

const GEOCODE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

type AddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

type GeocodeResult = {
  formatted_address?: string;
  place_id?: string;
  address_components?: AddressComponent[];
};

type GeocodePayload = {
  status?: string;
  results?: GeocodeResult[];
  error_message?: string;
};

function getGoogleLocationKey() {
  return process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
}

function componentValue(components: AddressComponent[] | undefined, type: string) {
  const component = components?.find((item) => item.types?.includes(type));
  return component?.long_name || component?.short_name || '';
}

function toSuggestion(result: GeocodeResult, index: number, country: SupportedCountry): LocationSuggestion {
  const components = result.address_components;
  const locality =
    componentValue(components, 'locality') ||
    componentValue(components, 'administrative_area_level_3') ||
    componentValue(components, 'sublocality') ||
    componentValue(components, 'postal_town');
  const state = componentValue(components, 'administrative_area_level_1');
  const postalCode = componentValue(components, 'postal_code');

  return {
    id: result.place_id || `${country}-${index}-${result.formatted_address || 'location'}`,
    label: result.formatted_address || [locality, state, postalCode].filter(Boolean).join(', '),
    locality,
    state,
    postalCode,
    country,
  };
}

export async function getLocationSuggestions(query: string, country: SupportedCountry): Promise<LocationSuggestionResponse> {
  const key = getGoogleLocationKey();
  if (!key) {
    return {
      configured: false,
      suggestions: [],
      message: 'Add GOOGLE_GEOCODING_API_KEY or GOOGLE_MAPS_API_KEY to enable Google location suggestions.',
    };
  }

  const url = new URL(GEOCODE_ENDPOINT);
  url.searchParams.set('address', query);
  url.searchParams.set('components', `country:${country}`);
  url.searchParams.set('language', 'en');
  url.searchParams.set('region', country.toLowerCase());
  url.searchParams.set('key', key);

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  const payload = (await response.json()) as GeocodePayload;
  if (!response.ok || !['OK', 'ZERO_RESULTS'].includes(payload.status || '')) {
    return {
      configured: true,
      suggestions: [],
      message: payload.error_message || 'Google could not return location suggestions for this query.',
    };
  }

  return {
    configured: true,
    suggestions: (payload.results || [])
      .slice(0, 5)
      .map((result, index) => toSuggestion(result, index, country))
      .filter((suggestion) => suggestion.label),
  };
}
