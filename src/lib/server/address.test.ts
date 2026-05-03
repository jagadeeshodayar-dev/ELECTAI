import { describe, expect, it } from 'vitest';
import { COMPLETE_ADDRESS_REQUIRED, resolveAddressForCivic, toFriendlyCivicAddressError } from './address';

describe('resolveAddressForCivic', () => {
  it('rejects incomplete spoken addresses before calling Civic', async () => {
    await expect(resolveAddressForCivic('number forty Victoria Avenue welcome')).rejects.toThrow(COMPLETE_ADDRESS_REQUIRED);
  });

  it('normalizes a complete address for Civic lookup', async () => {
    await expect(resolveAddressForCivic('number sixteen hundred Pennsylvania Ave NW, Washington, DC 20500')).resolves.toMatchObject({
      civicAddress: '1600 Pennsylvania Ave NW, Washington, DC 20500',
      source: 'input',
    });
  });

  it('turns Civic parse failures into a usable voter prompt', () => {
    expect(toFriendlyCivicAddressError('Failed to parse address')).toBe(COMPLETE_ADDRESS_REQUIRED);
  });
});
