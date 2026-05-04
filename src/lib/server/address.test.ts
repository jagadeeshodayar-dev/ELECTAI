import { describe, expect, it } from 'vitest';
import { getCompleteAddressRequired, resolveAddressForCivic, toFriendlyCivicAddressError } from './address';

describe('resolveAddressForCivic', () => {
  it('rejects incomplete spoken addresses before calling Civic', async () => {
    await expect(resolveAddressForCivic('number forty Victoria Avenue welcome', 'US')).rejects.toThrow(getCompleteAddressRequired('US'));
  });

  it('normalizes a complete address for Civic lookup', async () => {
    await expect(resolveAddressForCivic('number sixteen hundred Pennsylvania Ave NW, Washington, DC 20500', 'US')).resolves.toMatchObject({
      civicAddress: '1600 Pennsylvania Ave NW, Washington, DC 20500',
      country: 'US',
      source: 'input',
    });
  });

  it('accepts a complete India address for provider lookup', async () => {
    await expect(resolveAddressForCivic('MG Road, Bengaluru, Karnataka 560001', 'IN')).resolves.toMatchObject({
      civicAddress: 'MG Road, Bengaluru, Karnataka 560001',
      country: 'IN',
      source: 'input',
    });
  });

  it('turns Civic parse failures into a usable voter prompt', () => {
    expect(toFriendlyCivicAddressError('Failed to parse address', 'US')).toBe(getCompleteAddressRequired('US'));
  });
});
