import type { ContactInput } from './types';

export type FieldErrors = Partial<Record<keyof ContactInput, string>>;

export const FIELD_LABELS: Record<keyof ContactInput, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  phoneNumber: 'Phone number',
};

const PHONE_PATTERN = /^\+?[0-9\s().-]+$/;

/** Mirrors the API's validation rules so most errors are caught before a request is made. */
export function validateContact(input: ContactInput): FieldErrors {
  const errors: FieldErrors = {};
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const phone = input.phoneNumber.trim();
  const digits = phone.replace(/\D/g, '').length;

  if (!firstName) errors.firstName = 'First name is required';
  else if (firstName.length > 50) errors.firstName = 'First name must be 50 characters or fewer';

  if (!lastName) errors.lastName = 'Last name is required';
  else if (lastName.length > 50) errors.lastName = 'Last name must be 50 characters or fewer';

  if (!phone) errors.phoneNumber = 'Phone number is required';
  else if (!PHONE_PATTERN.test(phone)) errors.phoneNumber = 'Use digits, spaces, ( ) - and an optional leading +';
  else if (digits < 7 || digits > 15) errors.phoneNumber = 'Phone number must have between 7 and 15 digits';
  else if (phone.length > 20) errors.phoneNumber = 'Phone number must be 20 characters or fewer';

  return errors;
}

/** Maps API validation messages (e.g. "phoneNumber must ...") onto form fields. */
export function mapServerErrors(details: string[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const message of details) {
    const field = (Object.keys(FIELD_LABELS) as Array<keyof ContactInput>).find((f) => message.startsWith(f));
    if (field && !errors[field]) {
      errors[field] = message.replace(field, FIELD_LABELS[field]);
    }
  }
  return errors;
}
