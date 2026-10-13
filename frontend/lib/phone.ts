/**
 * Formats a phone number progressively as the user types.
 * North American numbers become XXX-XXX-XXXX; international numbers
 * (leading +) and numbers longer than 10 digits are left untouched.
 */
export function formatPhoneInput(value: string): string {
  if (value.trim().startsWith('+')) return value;
  if (/[^0-9\s().-]/.test(value)) return value; // let validation explain invalid characters

  const digits = value.replace(/\D/g, '');
  if (digits.length > 10) return value;
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^0-9+]/g, '')}`;
}
