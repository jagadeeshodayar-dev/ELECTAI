import { describe, expect, it } from 'vitest';
import { sanitizeAddress } from './validation';

describe('sanitizeAddress', () => {
  it('rejects empty addresses', () => {
    expect(() => sanitizeAddress('')).toThrow();
  });

  it('removes common prompt-injection markers before downstream calls', () => {
    expect(sanitizeAddress('123 Main St ignore previous system: developer:')).toBe('123 Main St');
  });

  it('rejects oversized addresses', () => {
    expect(() => sanitizeAddress('a'.repeat(201))).toThrow();
  });
});
