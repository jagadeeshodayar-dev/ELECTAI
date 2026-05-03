import { z } from 'zod';

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const PROMPT_MARKERS = /(```|<script|<\/script|system:|assistant:|ignore previous|developer:)/gi;

export const AddressSchema = z
  .string()
  .min(5, 'Enter a complete street address.')
  .max(200, 'Address is too long.')
  .transform((value) => value.replace(CONTROL_CHARS, ' ').replace(PROMPT_MARKERS, '').replace(/\s+/g, ' ').trim())
  .refine((value) => value.length >= 5, 'Enter a complete street address.');

export function sanitizeAddress(input: unknown) {
  return AddressSchema.parse(input);
}
