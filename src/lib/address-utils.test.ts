import { describe, expect, it } from 'vitest';
import { getAddressCompletionHint, hasCompleteAddressSignal, normalizeSpokenAddress } from './address-utils';

describe('address voice normalization', () => {
  it('converts common spoken street numbers without pretending the address is complete', () => {
    const normalized = normalizeSpokenAddress('number forty Victoria Avenue welcome');

    expect(normalized).toBe('40 Victoria Avenue welcome');
    expect(hasCompleteAddressSignal(normalized)).toBe(false);
    expect(getAddressCompletionHint(normalized)).toContain('city, state, and ZIP');
  });

  it('accepts a complete civic address signal', () => {
    expect(hasCompleteAddressSignal('1600 Pennsylvania Ave NW, Washington, DC 20500')).toBe(true);
  });
});
