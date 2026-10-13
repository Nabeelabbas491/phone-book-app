'use client';

import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, contactsApi } from '@/lib/api';
import { telHref } from '@/lib/phone';
import type { Contact, ContactInput } from '@/lib/types';
import { ConfirmDialog } from './ConfirmDialog';
import { ContactForm } from './ContactForm';
import { ContactBookIcon, PencilIcon, PhoneIcon, PlusIcon, SearchIcon, TrashIcon } from './icons';
import { ToastViewport, useToasts } from './Toasts';

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100; // API limit
const SEARCH_DEBOUNCE_MS = 250;

type Status = 'loading' | 'ready' | 'error';

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const fullName = (c: Pick<Contact, 'firstName' | 'lastName'>) => `${c.firstName} ${c.lastName}`;

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const index = text.toLowerCase().indexOf(q.toLowerCase());
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + q.length)}</mark>
      {text.slice(index + q.length)}
    </>
  );
}

function Avatar({ contact }: { contact: Contact }) {
  const initials = `${contact.firstName[0] ?? ''}${contact.lastName[0] ?? ''}`.toUpperCase();
  let hash = 0;
  for (const ch of fullName(contact)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span className="avatar" style={{ '--avatar-hue': hash % 360 } as CSSProperties} aria-hidden="true">
      {initials}
    </span>
  );
}

export function PhoneBook() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [pagesLoaded, setPagesLoaded] = useState(1);
  const [status, setStatus] = useState<Status>('loading');
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [editing, setEditing] = useState<Contact | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Contact | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const { toasts, show, dismiss } = useToasts();
  const abortRef = useRef<AbortController | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  /** (Re)loads the first `pages` pages for the given search term. */
  const load = useCallback(async (term: string, pages = 1) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const limit = Math.min(MAX_PAGE_SIZE, pages * PAGE_SIZE);

    setRefreshing(true);
    try {
      const res = await contactsApi.list({ search: term, page: 1, limit }, controller.signal);
      setContacts(res.data);
      setTotal(res.total);
      setPagesLoaded(limit / PAGE_SIZE);
      setStatus('ready');
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setLoadError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    } finally {
      if (abortRef.current === controller) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(debouncedSearch);
  }, [debouncedSearch, load]);

  const reload = useCallback(() => load(debouncedSearch, pagesLoaded), [load, debouncedSearch, pagesLoaded]);
  // Toast actions can fire seconds later, so they must use the latest reload, not a stale closure.
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  // "/" focuses the search box, like many web apps.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(target.tagName) && !document.querySelector('dialog[open]')) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Scroll a freshly created/updated contact into view and fade the highlight.
  useEffect(() => {
    if (!highlightId) return;
    document.getElementById(`contact-${highlightId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const timer = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(timer);
  }, [highlightId, contacts]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await contactsApi.list({ search: debouncedSearch, page: pagesLoaded + 1, limit: PAGE_SIZE });
      setContacts((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...res.data.filter((c) => !seen.has(c.id))];
      });
      setTotal(res.total);
      setPagesLoaded((p) => p + 1);
    } catch (err) {
      show({ tone: 'error', message: `Couldn't load more contacts: ${(err as Error).message}` });
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleSave(values: ContactInput) {
    if (editing === 'new') {
      const created = await contactsApi.create(values);
      setEditing(null);
      show({ tone: 'success', message: `${fullName(created)} added` });
      setHighlightId(created.id);
      if (search) setSearch(''); // make sure the new contact is visible
      else await reload();
    } else if (editing) {
      const changes: Partial<ContactInput> = {};
      for (const key of Object.keys(values) as Array<keyof ContactInput>) {
        if (values[key] !== editing[key]) changes[key] = values[key];
      }
      const updated = await contactsApi.update(editing.id, changes);
      setEditing(null);
      show({ tone: 'success', message: `${fullName(updated)} updated` });
      setHighlightId(updated.id);
      await reload();
    }
  }

  async function handleDelete(contact: Contact) {
    try {
      await contactsApi.remove(contact.id);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        show({ tone: 'error', message: `Couldn't delete ${fullName(contact)}: ${(err as Error).message}` });
        return;
      }
      // Already gone (e.g. deleted in another tab) — treat as success.
    }
    setDeleting(null);
    setContacts((prev) => prev.filter((c) => c.id !== contact.id));
    setTotal((t) => Math.max(0, t - 1));
    show({
      tone: 'success',
      message: `${fullName(contact)} deleted`,
      action: {
        label: 'Undo',
        onClick: async () => {
          try {
            const restored = await contactsApi.create({
              firstName: contact.firstName,
              lastName: contact.lastName,
              phoneNumber: contact.phoneNumber,
            });
            setHighlightId(restored.id);
            show({ tone: 'success', message: `${fullName(restored)} restored` });
            await reloadRef.current();
          } catch (err) {
            show({ tone: 'error', message: `Couldn't restore contact: ${(err as Error).message}` });
          }
        },
      },
    });
  }

  const isSearching = debouncedSearch.trim().length > 0;
  const hasMore = contacts.length < total;

  return (
    <main className="container">
      <h1 className="app-title">
        <ContactBookIcon className="app-logo" />
        Phone Book App
      </h1>

      <section className="panel" aria-labelledby="contacts-heading">
        <div className="toolbar">
          <h2 id="contacts-heading">
            Contacts
            {status === 'ready' && <span className="count" aria-label={`${total} contacts`}>{total}</span>}
          </h2>
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            <PlusIcon /> Add Contact
          </button>
        </div>

        <div className="search">
          <SearchIcon className="search-icon" />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search by name or phone number…"
            aria-label="Search contacts"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setSearch('')}
          />
          {refreshing && status === 'ready' && <span className="spinner" aria-label="Searching" />}
          {!refreshing && <kbd className="search-hint" aria-hidden="true">/</kbd>}
        </div>

        {status === 'loading' && (
          <ul className="contact-list" aria-busy="true" aria-label="Loading contacts">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="contact skeleton">
                <span className="avatar" />
                <div className="contact-text">
                  <span className="skeleton-line" style={{ width: '40%' }} />
                  <span className="skeleton-line" style={{ width: '25%' }} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {status === 'error' && (
          <div className="empty-state" role="alert">
            <p className="empty-title">Couldn&apos;t load contacts</p>
            <p className="empty-text">{loadError}</p>
            <button type="button" className="btn btn-secondary" onClick={() => { setStatus('loading'); void reload(); }}>
              Try again
            </button>
          </div>
        )}

        {status === 'ready' && contacts.length === 0 && (
          <div className="empty-state">
            {isSearching ? (
              <>
                <p className="empty-title">No contacts match &ldquo;{debouncedSearch}&rdquo;</p>
                <button type="button" className="btn btn-secondary" onClick={() => setSearch('')}>
                  Clear search
                </button>
              </>
            ) : (
              <>
                <p className="empty-title">Your phone book is empty</p>
                <p className="empty-text">Add your first contact to get started.</p>
                <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
                  <PlusIcon /> Add Contact
                </button>
              </>
            )}
          </div>
        )}

        {status === 'ready' && contacts.length > 0 && (
          <>
            <ul className={`contact-list${refreshing ? ' is-refreshing' : ''}`}>
              {contacts.map((contact) => (
                <li
                  key={contact.id}
                  id={`contact-${contact.id}`}
                  className={`contact${highlightId === contact.id ? ' is-highlighted' : ''}`}
                >
                  <button
                    type="button"
                    className="contact-main"
                    onClick={() => setEditing(contact)}
                    aria-label={`Edit ${fullName(contact)}`}
                  >
                    <Avatar contact={contact} />
                    <span className="contact-text">
                      <span className="contact-name">
                        <Highlight text={fullName(contact)} query={debouncedSearch} />
                      </span>
                      <span className="contact-phone">
                        <PhoneIcon /> {contact.phoneNumber}
                      </span>
                    </span>
                  </button>
                  <div className="contact-actions">
                    <a className="icon-btn" href={telHref(contact.phoneNumber)} aria-label={`Call ${fullName(contact)}`} title="Call">
                      <PhoneIcon />
                    </a>
                    <button type="button" className="icon-btn" onClick={() => setEditing(contact)} aria-label={`Edit ${fullName(contact)}`} title="Edit">
                      <PencilIcon />
                    </button>
                    <button type="button" className="btn-delete" onClick={() => setDeleting(contact)} aria-label={`Delete ${fullName(contact)}`} title="Delete">
                      <TrashIcon />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="list-footer">
              <span>
                Showing {contacts.length} of {total}
              </span>
              {hasMore && (
                <button type="button" className="btn btn-secondary" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {editing && (
        <ContactForm
          key={editing === 'new' ? 'new' : editing.id}
          contact={editing === 'new' ? undefined : editing}
          onSubmit={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete contact?"
          message={`${fullName(deleting)} (${deleting.phoneNumber}) will be removed from your phone book.`}
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}

      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </main>
  );
}
