# Phone Book App

This is my submission for the Full Stack Developer coding assessment. It's a small phone book where you can add, view, edit, search and delete contacts. The frontend is built with Next.js, the API with NestJS, and the data is stored in PostgreSQL.

![Contacts list](docs/images/contacts.png)

## What it does

The main screen shows all your contacts sorted by last name. From there you can:

- Add a contact using the "Add Contact" button. You'll need a first name, last name and phone number.
- Edit a contact by clicking on it. Any of the three fields can be changed.
- Delete a contact with the red button on the right. You'll be asked to confirm, and there's an Undo option for a few seconds afterwards in case you clicked by mistake.
- Search using the box at the top. It matches first names, last names, full names and phone numbers, so "steve woz" or "343" both work.

A few other things I added to make it nicer to use:

- The form validates input before sending it, and also shows errors coming back from the server next to the right field.
- Phone numbers are formatted as you type, so `2204546754` becomes `220-454-6754`. International numbers starting with `+` are left as they are.
- Loading, empty and error states, plus a "Load more" button when there are lots of contacts.
- Works on mobile, supports dark mode, and is usable with just a keyboard (press `/` to jump to the search box).

| Add / edit form | Mobile, dark mode |
| --- | --- |
| ![Add contact](docs/images/add-contact.png) | ![Mobile dark mode](docs/images/mobile-dark.png) |

I also did the optional items:

- The whole app runs in Docker with a single command.
- There's a design document in [docs/SOFTWARE_DESIGN.md](docs/SOFTWARE_DESIGN.md) that explains how everything fits together and why.
- There's a script for deploying to Google Cloud in [deploy/gcp](deploy/gcp).

## Running it locally

There are two ways to run the project. Docker is the easiest because it sets up the database for you.

### With Docker

You need Docker Desktop installed. From the project folder, run:

```bash
docker compose up --build
```

Once it's started, open http://localhost:3000 in your browser. The API documentation is at http://localhost:3001/api/docs.

The database starts with five sample contacts. Your data is kept between restarts. If you want to start fresh, run `docker compose down -v`.

### Without Docker

You'll need Node.js (version 20.9 or newer, 22 is recommended) and a PostgreSQL database.

**1. Set up the database**

If you have Docker, you can start just the database:

```bash
docker compose up -d db
```

Otherwise, create a user and database on your own PostgreSQL server:

```sql
CREATE USER phonebook WITH PASSWORD 'phonebook';
CREATE DATABASE phonebook OWNER phonebook;
```

**2. Start the API**

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

The API runs on http://localhost:3001. It creates the database table automatically the first time it starts, and adds the sample contacts if the table is empty. If your database details are different from the defaults, change them in `backend/.env`.

**3. Start the frontend**

Open a second terminal:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Then go to http://localhost:3000.

### Configuration

The API reads these environment variables (see `backend/.env.example`):

| Variable | Default | What it's for |
| --- | --- | --- |
| `PORT` | `3001` | Port the API listens on |
| `DATABASE_URL` | not set | Full connection string. If set, it's used instead of the `DB_` values below |
| `DB_HOST`, `DB_PORT` | `localhost`, `5432` | Database server |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | `phonebook` for all three | Database login and name |
| `DB_SSL` | `false` | Set to `true` if your database requires SSL |
| `CORS_ORIGIN` | `http://localhost:3000` | Which websites are allowed to call the API directly |
| `SEED_DATA` | `false` | Set to `true` to add sample contacts when the database is empty |

The frontend only needs `API_URL`, which tells it where the API is running (default `http://localhost:3001`).

## Running the tests

```bash
cd backend
npm test
```

That runs the unit tests and doesn't need a database.

There are also end-to-end tests that call the real API against a real database. They empty the contacts table before each test, so use a separate test database:

```bash
DATABASE_URL=postgres://phonebook:phonebook@localhost:5432/phonebook_test npm run test:e2e
```

When the code is pushed to GitHub, a CI workflow runs the type checks, builds, all the tests, and a test of the Docker setup.

## API

All endpoints are under `/api`. You can also try them out in the browser at http://localhost:3001/api/docs.

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/contacts` | List contacts. Supports `search`, `page` and `limit` query parameters |
| GET | `/contacts/:id` | Get a single contact |
| POST | `/contacts` | Create a contact |
| PATCH | `/contacts/:id` | Update one or more fields of a contact |
| DELETE | `/contacts/:id` | Delete a contact |
| GET | `/health` | Check that the API and database are up |

Example:

```bash
curl -X POST http://localhost:3001/api/contacts \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Ada","lastName":"Lovelace","phoneNumber":"555-123-4567"}'
```

If the input is invalid, the API responds with a 400 and a list of what's wrong. Asking for a contact that doesn't exist gives a 404.

## Project layout

```
backend/        NestJS API (contacts module, database setup, tests)
frontend/       Next.js app (pages, components, API client)
docs/           Design document and screenshots
docker-compose.yml
```
