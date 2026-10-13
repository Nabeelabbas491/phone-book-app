# Software Design Document: Phone Book App

| | |
| --- | --- |
| **Version** | 1.0 |
| **Status** | Implemented |
| **Stack** | Next.js 16 · NestJS 11 · PostgreSQL 17 · Docker · Google Cloud Run / Cloud SQL |

## 1. Introduction

### 1.1 Purpose
This document describes the design of the Phone Book App: its architecture, components, data model, API contract, the main design decisions, and how it is deployed. It is written for engineers who will review, run, or extend the solution.

### 1.2 Scope
The application lets a user manage a list of contacts, each with a first name, last name and phone number. It supports the four CRUD operations (create, read, update, delete) plus search. There are no user accounts. The phone book is a single shared list.

### 1.3 Requirements

| ID | Requirement | Where it is met |
| --- | --- | --- |
| FR-1 | Enter first name, last name and phone number in a form | `ContactForm` modal |
| FR-2 | Create new entries in the database | `POST /api/contacts` |
| FR-3 | Read / list entries | `GET /api/contacts` and the contact list |
| FR-4 | Update entries by editing any property | `PATCH /api/contacts/:id` and the edit modal |
| FR-5 | Delete entries | `DELETE /api/contacts/:id` and the delete button with confirmation |
| FR-6 | Search contacts (shown in the mockup) | `search` query parameter and the search box |
| NFR-1 | Separate front end, back end and database | Three independently deployable components |
| NFR-2 | Next.js, NestJS and PostgreSQL | As required |
| NFR-3 | Easy to run locally | `docker compose up`, or step-by-step instructions in the README |
| NFR-4 | Input is validated and errors are understandable | Validation runs on both client and server, with field-level messages |
| NFR-5 | Accessible and responsive | Native `<dialog>`, labels, ARIA, keyboard support, mobile layout, dark mode |

## 2. Architecture overview

```
 ┌──────────────────────────┐        ┌────────────────────────────┐        ┌──────────────────┐
 │        Browser           │        │   Next.js server (web)     │        │  NestJS (api)    │
 │  React client components │ /api/* │  • serves the UI           │ /api/* │  • REST controllers
 │  (PhoneBook, ContactForm)├───────►│  • route handler proxy     ├───────►│  • validation     │
 │                          │  same  │    app/api/[...path]       │  HTTP  │  • service layer  │
 └──────────────────────────┘ origin └────────────────────────────┘        │  • TypeORM        │
                                                                           └────────┬─────────┘
                                                                                    │ SQL (pg)
                                                                           ┌────────▼─────────┐
                                                                           │   PostgreSQL     │
                                                                           │  contacts table  │
                                                                           └──────────────────┘
```

The system has three tiers:

1. **Web (Next.js)** renders the UI. Data handling happens in client components, because the page is highly interactive (live search, modals, optimistic deletes). The Next.js server also exposes a small catch-all **proxy route** that forwards `/api/*` to the API.
2. **API (NestJS)** is a stateless REST service that owns all business rules, including validation, phone normalisation, search and pagination.
3. **Database (PostgreSQL)** is the single source of truth. Its schema is managed by versioned migrations.

### 2.1 Why a same-origin proxy?
The browser only ever calls its own origin (`/api/contacts`). The Next.js route handler forwards each request to `API_URL`, which is read **at runtime**. This gives four benefits:
- **No CORS** in the normal path, and the API address is never baked into the JS bundle.
- **One image for every environment.** The same frontend image runs in local dev (`localhost:3001`), Docker (`http://api:3001`) and Cloud Run (`https://phonebook-api-…run.app`) with only an environment variable changed. Next.js `NEXT_PUBLIC_*` variables would need a rebuild for each environment.
- It provides a seam for future concerns such as auth headers, rate limiting, or calling a private API with a service identity.
- **Trade-off:** each request takes one extra network hop. That is negligible for this workload.

The API still enables CORS for an explicit allow-list (`CORS_ORIGIN`), so it can be called directly, for example from Swagger UI.

## 3. Backend design (NestJS)

### 3.1 Modules

| Module / file | Responsibility |
| --- | --- |
| `AppModule` | Wires the config, TypeORM connection and feature modules |
| `ContactsModule` | Contacts controller and service. Seeds sample data on bootstrap when `SEED_DATA=true` |
| `ContactsController` | HTTP mapping only: routes, status codes, `ParseUUIDPipe`, Swagger annotations |
| `ContactsService` | Business logic: queries, search, pagination, normalisation, not-found handling |
| `HealthController` | `GET /api/health` runs `SELECT 1`, for Docker and Cloud Run health checks |
| `database.config.ts` | Builds the connection options from env vars. Shared by the app and the TypeORM CLI |
| `setup-app.ts` | Global prefix and `ValidationPipe`. Shared by `main.ts` and the e2e tests so tests match production |

### 3.2 Request pipeline
1. `ValidationPipe` with `whitelist`, `forbidNonWhitelisted` and `transform`: unknown properties are rejected (protecting against mass assignment), strings are trimmed by `@Transform`, and query params are converted to numbers.
2. `ParseUUIDPipe` on `:id` returns `400` before a malformed id reaches the database.
3. The service throws `NotFoundException` and Nest's exception filter turns it into a `404` JSON response.

### 3.3 Validation rules

| Field | Rules |
| --- | --- |
| `firstName`, `lastName` | Required string, trimmed, 1–50 characters |
| `phoneNumber` | Required, at most 20 characters, only digits, spaces, `( ) - .` and a leading `+`, with 7–15 digits (the E.164 maximum) |

The same rules are implemented in `frontend/lib/validation.ts`, so most errors are caught before a request is made. The server stays authoritative. Its messages start with the property name (for example `phoneNumber must …`), which lets the client map them onto the right field.

### 3.4 Phone normalisation
Numbers are stored in a consistent display format. A 10-digit number without `+` becomes `XXX-XXX-XXXX` (the format in the mockup). Anything else, such as international numbers, is kept as entered with whitespace collapsed. Search compares **digits only** (`regexp_replace(phone_number, '[^0-9]', '', 'g')`), so `2204`, `220-4` and `(220) 4` all match.

### 3.5 Search and pagination
- `search` is matched case-insensitively (`ILIKE`) against first name, last name, `first || ' ' || last` (so "steve woz" works), and phone digits.
- LIKE wildcards in user input (`%`, `_`, `\`) are escaped, so a search for `%` is literal. All values are passed as bound parameters, never concatenated, which prevents SQL injection.
- Results are ordered by `lower(last_name), lower(first_name), created_at`, which is the natural phone-book order and stable across pages.
- Offset pagination uses `page` (from 1) and `limit` (1–100, default 50). The response is `{ data, total, page, limit }`. Offset paging is the simplest correct choice at this data size. Keyset pagination is the upgrade path if the data grows to many thousands of rows.

## 4. Data design

### 4.1 Schema

```sql
CREATE TABLE contacts (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name    varchar(50)  NOT NULL,
  last_name     varchar(50)  NOT NULL,
  phone_number  varchar(20)  NOT NULL,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX "IDX_contacts_last_name_first_name" ON contacts (lower(last_name), lower(first_name));
```

| Decision | Rationale |
| --- | --- |
| **UUID primary keys** | Ids are not guessable or enumerable, and can be generated anywhere |
| **`varchar` limits match DTO limits** | The database enforces the same invariants as the API (defence in depth) |
| **`timestamptz` audit columns** | Unambiguous timestamps. Useful for sorting ties and debugging |
| **Expression index on `lower(last_name), lower(first_name)`** | Serves the default sort order |
| **No unique constraint on phone number** | Real households share landlines, and one person can appear twice. Duplicates are a UX concern, not an integrity one |
| **Migrations, never `synchronize`** | Schema changes are explicit, reviewable and reversible. `migrationsRun: true` applies pending migrations on startup, which suits a single-instance sandbox |

### 4.2 Entity mapping
TypeORM maps camelCase properties (`firstName`) to snake_case columns (`first_name`). The entity is also the response schema in Swagger.

## 5. Frontend design (Next.js)

### 5.1 Component tree
```
app/layout.tsx
└── app/page.tsx
    └── <PhoneBook>                     state: list, search, paging, modals, toasts
        ├── search input                debounced 250 ms, "/" shortcut, Esc clears
        ├── contact list                avatar · highlighted name · phone · call/edit/delete
        ├── <ContactForm> (Modal)       create + edit, client validation, phone auto-format
        ├── <ConfirmDialog> (Modal)     delete confirmation
        └── <ToastViewport>             success / error toasts, "Undo" action
```

### 5.2 State and data flow
- **Fetching:** `load(term, pages)` calls `GET /api/contacts`. An `AbortController` cancels any in-flight request when a newer one starts, so fast typing can never show stale results.
- **After create/update:** the list is re-fetched (keeping the number of loaded pages) instead of being patched locally. This keeps server-side sorting and search filtering correct. The changed row is scrolled into view and highlighted.
- **Edit sends a diff:** only changed fields go in the `PATCH` body, and Save is disabled until something changes.
- **Delete:** confirm, then `DELETE`, then remove the row locally (no refetch needed), then show a toast with **Undo**. Undo re-creates the contact from the copy kept in memory. It gets a new id, which is acceptable because nothing references contact ids. A `404` on delete (already removed elsewhere) is treated as success.
- **Errors:** `ApiError` carries the status and the server's validation messages. Load failures show an inline retry state, and mutation failures show toasts or field errors.

### 5.3 UX and accessibility
- Native `<dialog>` with `showModal()` provides focus trapping, `Esc` handling, the top layer and correct ARIA semantics without a library. Backdrop click also closes it.
- All icon buttons have `aria-label`s, inputs have `<label>`s, invalid fields set `aria-invalid` and `aria-describedby`, and toasts sit in an `aria-live` region.
- The layout follows the mockup (title with contact-book icon, "Contacts" header with **+ Add Contact**, search bar, bordered list with red delete buttons). It adds avatars, counts, dark mode, a mobile layout and `prefers-reduced-motion` support.
- No CSS framework is used: a single `globals.css` with design tokens (CSS custom properties) keeps the bundle small and the theme easy to change.

## 6. Error handling summary

| Situation | API | UI |
| --- | --- | --- |
| Invalid input | `400` with a `message[]` | Field-level messages under the inputs |
| Unknown property in body | `400` | (cannot happen from the UI) |
| Malformed id | `400` | n/a |
| Contact not found | `404` | Delete treats it as success. Edit shows the error |
| API unreachable | n/a | Proxy returns `502` with a friendly message, and the list shows a retry state |
| Database down | `/api/health` returns `503` | Container or Cloud Run health checks flag the instance |

## 7. Security considerations
- Bound SQL parameters everywhere, and LIKE wildcards are escaped.
- DTO whitelisting rejects unexpected fields.
- `ParseUUIDPipe` stops malformed ids from reaching the database.
- CORS is restricted to configured origins, and `X-Powered-By` is disabled on the frontend.
- Containers run as the non-root `node` user.
- On GCP, the DB password is generated randomly and kept in **Secret Manager**. The API reaches Cloud SQL over the Cloud SQL connector's Unix socket, with no public IP allow-list, and runs as a dedicated least-privilege service account (`cloudsql.client`, `secretmanager.secretAccessor`).
- **Out of scope:** authentication and authorisation. The assessment describes a single shared phone book. The natural extension is OAuth/OIDC login at the Next.js layer, which would forward an identity token through the proxy, with an `owner_id` column on `contacts`.

## 8. Testing strategy

| Level | Tooling | What it covers |
| --- | --- | --- |
| Unit | Jest | Phone normalisation, service logic (partial update, not-found, seeding) with a mocked repository |
| End-to-end | Jest + Supertest + real PostgreSQL | Full CRUD lifecycle, sort order, search by last name, full name and phone digits, wildcard escaping, pagination, validation errors, 400 vs 404, health |
| Build / types | `tsc`, `nest build`, `next build` | Type safety across both apps |
| Smoke | GitHub Actions + Docker Compose | Whole stack starts healthy, and `/api/contacts` answers through the web proxy |

## 9. Future enhancements
- Authentication and per-user phone books.
- Multiple phone numbers or emails per contact, favourites and groups.
- Duplicate detection when adding ("A contact with this number already exists. Add anyway?").
- Import and export (CSV / vCard).
- Postgres full-text or trigram (`pg_trgm`) indexes for fuzzy search at scale.
- Frontend component tests (React Testing Library) and Playwright UI tests in CI.
