/** Characters a user may reasonably type in a phone number. */
export const PHONE_PATTERN = /^\+?[0-9\s().-]+$/;

export const MIN_PHONE_DIGITS = 7;
export const MAX_PHONE_DIGITS = 15; // E.164 maximum

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Normalises a phone number for storage and display.
 * 10-digit (North American) numbers become `XXX-XXX-XXXX`; anything else is
 * kept as entered with whitespace collapsed.
 */
export function normalizePhone(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  const digits = phoneDigits(trimmed);
  if (!trimmed.startsWith('+') && digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return trimmed;
}
