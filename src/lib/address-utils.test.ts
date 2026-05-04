import { describe, expect, it } from 'vitest';
import { getAddressCompletionHint, hasCompleteAddressSignal, normalizeSpokenAddress } from './address-utils';

describe('address voice normalization', () => {
  it('converts common spoken street numbers without pretending the address is complete', () => {
    const normalized = normalizeSpokenAddress('number forty Victoria Avenue welcome');

    expect(normalized).toBe('40 Victoria Avenue welcome');
    expect(hasCompleteAddressSignal(normalized, 'US')).toBe(false);
    expect(getAddressCompletionHint(normalized, 'US')).toContain('city, state, and ZIP');
  });

  it('accepts a complete civic address signal', () => {
    expect(hasCompleteAddressSignal('1600 Pennsylvania Ave NW, Washington, DC 20500', 'US')).toBe(true);
  });

  it('accepts a complete India address signal', () => {
    expect(hasCompleteAddressSignal('MG Road, Bengaluru, Karnataka 560001', 'IN')).toBe(true);
    expect(getAddressCompletionHint('MG Road, Bengaluru', 'IN')).toContain('6-digit PIN');
  });
});
