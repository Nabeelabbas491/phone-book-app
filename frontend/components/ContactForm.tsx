'use client';

import { FormEvent, useState } from 'react';
import { ApiError } from '@/lib/api';
import { formatPhoneInput } from '@/lib/phone';
import type { Contact, ContactInput } from '@/lib/types';
import { FIELD_LABELS, FieldErrors, mapServerErrors, validateContact } from '@/lib/validation';
import { Modal } from './Modal';

interface ContactFormProps {
  /** When provided the form edits this contact; otherwise it creates a new one. */
  contact?: Contact;
  onSubmit: (values: ContactInput) => Promise<void>;
  onClose: () => void;
}

const FIELDS: Array<{ name: keyof ContactInput; autoComplete: string; type: string; placeholder: string }> = [
  { name: 'firstName', autoComplete: 'given-name', type: 'text', placeholder: 'e.g. Steve' },
  { name: 'lastName', autoComplete: 'family-name', type: 'text', placeholder: 'e.g. Jobs' },
  { name: 'phoneNumber', autoComplete: 'tel', type: 'tel', placeholder: 'e.g. 220-454-6754' },
];

export function ContactForm({ contact, onSubmit, onClose }: ContactFormProps) {
  const initial: ContactInput = {
    firstName: contact?.firstName ?? '',
    lastName: contact?.lastName ?? '',
    phoneNumber: contact?.phoneNumber ?? '',
  };
  const [values, setValues] = useState<ContactInput>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = Boolean(contact);
  const isDirty = (Object.keys(initial) as Array<keyof ContactInput>).some(
    (k) => values[k].trim() !== initial[k],
  );

  function setField(name: keyof ContactInput, raw: string) {
    const value = name === 'phoneNumber' ? formatPhoneInput(raw) : raw;
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const clientErrors = validateContact(values);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      document.getElementById(`field-${Object.keys(clientErrors)[0]}`)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phoneNumber: values.phoneNumber.trim(),
      });
    } catch (err) {
      const serverErrors = err instanceof ApiError ? mapServerErrors(err.details) : {};
      if (Object.keys(serverErrors).length > 0) setErrors(serverErrors);
      else setFormError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  return (
    <Modal title={isEdit ? 'Edit Contact' : 'Add Contact'} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        {FIELDS.map(({ name, ...input }, i) => (
          <div className="field" key={name}>
            <label htmlFor={`field-${name}`}>{FIELD_LABELS[name]}</label>
            <input
              id={`field-${name}`}
              name={name}
              value={values[name]}
              onChange={(e) => setField(name, e.target.value)}
              aria-invalid={Boolean(errors[name])}
              aria-describedby={errors[name] ? `error-${name}` : undefined}
              maxLength={name === 'phoneNumber' ? 20 : 50}
              autoFocus={i === 0}
              {...input}
            />
            {errors[name] && (
              <p className="field-error" id={`error-${name}`}>
                {errors[name]}
              </p>
            )}
          </div>
        ))}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting || (isEdit && !isDirty)}>
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Contact'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
