import type { Contact, ContactInput, Paginated } from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Individual validation messages returned by the API, if any. */
    readonly details: string[] = [],
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError('Network error. Check your connection and try again.', 0);
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let details: string[] = [];
    try {
      const body = await res.json();
      if (Array.isArray(body.message)) {
        details = body.message;
        message = details.join('. ');
      } else if (typeof body.message === 'string') {
        message = body.message;
      }
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw new ApiError(message, res.status, details);
  }

  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const contactsApi = {
  list(params: { search?: string; page?: number; limit?: number }, signal?: AbortSignal) {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    return request<Paginated<Contact>>(`/contacts?${qs}`, { signal });
  },
  create(input: ContactInput) {
    return request<Contact>('/contacts', { method: 'POST', body: JSON.stringify(input) });
  },
  update(id: string, changes: Partial<ContactInput>) {
    return request<Contact>(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
  },
  remove(id: string) {
    return request<void>(`/contacts/${id}`, { method: 'DELETE' });
  },
};
