import { MISSING, SupportedCountry } from '@/types';

const STREET_WORDS = /\b(allee|aly|avenue|ave|boulevard|blvd|circle|cir|court|ct|drive|dr|highway|hwy|lane|ln|parkway|pkwy|place|pl|road|rd|route|rte|square|sq|street|st|terrace|ter|trail|trl|way)\b/i;
const US_ZIP_CODE = /\b\d{5}(?:-\d{4})?\b/;
const INDIA_PIN_CODE = /\b\d{6}\b/;

const STATE_NAMES = [
  'alabama',
  'alaska',
  'arizona',
  'arkansas',
  'california',
  'colorado',
  'connecticut',
  'delaware',
  'district of columbia',
  'florida',
  'georgia',
  'hawaii',
  'idaho',
  'illinois',
  'indiana',
  'iowa',
  'kansas',
  'kentucky',
  'louisiana',
  'maine',
  'maryland',
  'massachusetts',
  'michigan',
  'minnesota',
  'mississippi',
  'missouri',
  'montana',
  'nebraska',
  'nevada',
  'new hampshire',
  'new jersey',
  'new mexico',
  'new york',
  'north carolina',
  'north dakota',
  'ohio',
  'oklahoma',
  'oregon',
  'pennsylvania',
  'rhode island',
  'south carolina',
  'south dakota',
  'tennessee',
  'texas',
  'utah',
  'vermont',
  'virginia',
  'washington',
  'west virginia',
  'wisconsin',
  'wyoming',
];

const STATE_ABBREVIATIONS = new Set([
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'DC',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
]);

const DIGIT_WORDS: Record<string, string> = {
  zero: '0',
  oh: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
};

const SMALL_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fourty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const INTRO_PHRASES = [
  /^\s*(my\s+)?(voting\s+)?address\s+is\s+/i,
  /^\s*(please\s+)?use\s+(the\s+)?address\s+/i,
  /^\s*i\s+live\s+at\s+/i,
  /^\s*i\s+am\s+at\s+/i,
  /^\s*it\s+is\s+/i,
];

function hasStateName(value: string) {
  const lower = value.toLowerCase();
  return STATE_NAMES.some((state) => new RegExp(`\\b${state}\\b`, 'i').test(lower));
}

function hasStateAbbreviation(value: string) {
  const tokens = value.split(/[\s,]+/).filter(Boolean);
  return tokens.some((token, index) => {
    const cleaned = token.replace(/[^a-z]/gi, '');
    const upper = cleaned.toUpperCase();
    if (!STATE_ABBREVIATIONS.has(upper)) return false;

    const originalLooksLikeState = cleaned === upper || cleaned.length === 2;
    const nearAddressEnd = index >= Math.max(0, tokens.length - 3);
    return originalLooksLikeState && nearAddressEnd;
  });
}

function hasStreetAfter(tokens: string[], startIndex: number) {
  return tokens.slice(startIndex, startIndex + 6).some((token) => STREET_WORDS.test(token));
}

function replaceLeadingNumberWords(value: string) {
  const tokens = value.replace(/-/g, ' ').split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || /^\d/.test(tokens[0])) return value;

  const digitParts: string[] = [];
  for (const token of tokens) {
    const digit = DIGIT_WORDS[token.toLowerCase()];
    if (digit === undefined) break;
    digitParts.push(digit);
  }

  if (digitParts.length >= 2 && hasStreetAfter(tokens, digitParts.length)) {
    return [digitParts.join(''), ...tokens.slice(digitParts.length)].join(' ');
  }

  let total = 0;
  let consumed = 0;
  for (const token of tokens.slice(0, 4)) {
    const lower = token.toLowerCase();
    if (SMALL_NUMBERS[lower]) {
      total += SMALL_NUMBERS[lower];
      consumed += 1;
      continue;
    }
    if (TENS[lower]) {
      total += TENS[lower];
      consumed += 1;
      continue;
    }
    if (lower === 'hundred' && total > 0) {
      total *= 100;
      consumed += 1;
      continue;
    }
    break;
  }

  if (total > 0 && consumed > 0 && hasStreetAfter(tokens, consumed)) {
    return [String(total), ...tokens.slice(consumed)].join(' ');
  }

  return value;
}

export function normalizeSpokenAddress(input: string) {
  let value = input
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  for (const phrase of INTRO_PHRASES) {
    value = value.replace(phrase, '');
  }

  value = value
    .replace(/^\s*(number|no\.?)\s+(?=[a-z0-9])/i, '')
    .replace(/\b(apartment|apt)\s+number\s+/gi, 'Apt ')
    .replace(/\b(zip|zipcode|zip code)\s+(\d{5})\b/gi, '$2')
    .replace(/\b(pin|pincode|pin code)\s+(\d{6})\b/gi, '$2')
    .replace(/\s+,/g, ',')
    .replace(/,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

  return replaceLeadingNumberWords(value);
}

function hasCompleteUsAddressSignal(value: string) {
  const hasStreetNumber = /\b\d+[a-z]?\b/i.test(value);
  const hasStreet = STREET_WORDS.test(value);
  const hasStateOrZip = US_ZIP_CODE.test(value) || hasStateAbbreviation(value) || hasStateName(value);

  return hasStreetNumber && hasStreet && hasStateOrZip;
}

function hasCompleteIndiaAddressSignal(value: string) {
  const hasPinCode = INDIA_PIN_CODE.test(value);
  const words = value
    .replace(INDIA_PIN_CODE, '')
    .split(/[\s,]+/)
    .map((part) => part.replace(/[^a-z]/gi, ''))
    .filter((part) => part.length >= 3);

  return hasPinCode && words.length >= 3;
}

export function hasCompleteAddressSignal(input: string, country: SupportedCountry = 'IN') {
  const value = normalizeSpokenAddress(input);

  return country === 'US' ? hasCompleteUsAddressSignal(value) : hasCompleteIndiaAddressSignal(value);
}

export function getAddressCompletionHint(input: string, country: SupportedCountry = 'IN') {
  if (!input.trim() || input === MISSING || hasCompleteAddressSignal(input, country)) return '';
  if (country === 'US') {
    return 'Add city, state, and ZIP so Google Civic can find the correct ballot and polling place.';
  }
  return 'Add locality, city, state, and 6-digit PIN code so Google can verify the India address.';
}

export function formatCivicAddress(parts: {
  locationName?: string;
  line1?: string;
  city?: string;
  state?: string;
  zip?: string;
}) {
  const cityStateZip = [parts.city, parts.state, parts.zip]
    .filter((part) => part && part !== MISSING)
    .join(' ');
  return [parts.locationName, parts.line1, cityStateZip]
    .filter((part) => part && part !== MISSING)
    .join(', ');
}

export function safeExternalUrl(value?: string) {
  if (!value || value === MISSING) return null;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}
