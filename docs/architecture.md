# Architecture

How Рядом is put together.

Three parts: a React client in the browser, a Hono API, and one SQLite
file. The API runs on two adapters, so the same application is a Cloudflare
Worker with D1 in one build and a Node container with `node:sqlite` in the
other.

```
browser (React, Mantine, PWA)
  -> /api  (Hono, one app)
  -> SQLite (one file)
```

## The shape

| Module | What it is responsible for |
| --- | --- |
| `app/src/` | The React client: one file per screen, the shared helpers beside them and the stylesheet. 55 files. |
| `app/server/index.ts` | The routes, the session check, the role checks and the body limits. |
| `app/server/node.ts` | The Node adapter for the container: `node:http`, the static files and the background jobs. |
| `app/server/sqlite.ts` | The D1-shaped adapter over `node:sqlite`, and the migration runner. |
| `app/server/db.ts` | `one`, `many`, `run` and `logAction`, the four calls every route uses. |
| `app/server/auth.ts` | The password hashing and the digests: scrypt for the password, SHA-256 for the tokens. |
| `app/server/account.ts`, `admin.ts`, `booking.ts`, `card.ts`, `care.ts`, `directory.ts`, `inbox.ts`, `notices.ts`, `notifications.ts`, `practice-templates.ts`, `profile-documents.ts`, `profiles.ts`, `surveys.ts`, `verification.ts`, `zip.ts`, `zones.ts` | The routes, grouped by the part of the product they serve. |
| `app/server/jobs.ts` | The services the background jobs use: the delivery of the notifications and the daily backup. |
| `app/server/upload-limits.ts` | The list of routes that may carry a file and the limit of each. |
| `app/db/schema.ts` | The Drizzle schema, 27 tables. |
| `app/drizzle/` | The migrations: 23 files of plain SQL, applied in order. |
| `app/tests/` | The Vitest suite and the Playwright browser scenarios. |
| `app/scripts/` | The backup, the off-site copy, the administration, the verification and the integration scripts. |

## The data flow

A check-in:

```
browser -> POST /api/patient/checkin
  session cookie -> sessions table -> user
  Origin header checked against the request origin
  body limit checked by the route
  one INSERT into checkins
  one INSERT into checkin_revisions
  a push subscription row and a delivery row for the doctor
```

Reading the doctor's overview:

```
browser -> GET /api/doctor/patients/:id
  session cookie -> sessions table -> user -> role
  the entries, the practice logs, the goals and the assessments of the period
  the answer to the doctor is JSON, and nothing is cached
```

The client is a Vite application: React 19, Mantine 8, and a service worker
that caches the shell and the static assets. The API is never cached, and
the clinical records are not kept in `localStorage`.

## Decisions worth knowing about

### The API runs on two adapters

`app/server/index.ts` is written against a D1 binding. The Cloudflare
Worker build passes the real D1 binding, and the Node build passes the
object that `app/server/sqlite.ts` builds over `node:sqlite`: `prepare`,
`batch` and the four statement methods.

The cost: the adapter has to answer the shape of D1, not the shape of
SQLite. The Node adapter is about forty lines and it is the only place that
knows which database is underneath.

### A migration that has run never changes

The Node runner keeps a SHA-256 checksum of every file it has applied in a
`_ryadom_migrations` table, and it refuses to start when one of them has
changed. The 23 files in `app/drizzle/` are plain SQL and are applied in
order inside a transaction.

The cost: a migration that turns out to be wrong is corrected by a new
file, never by editing an old one.

### The session token is random and only its digest is stored

The cookie carries a random token, it is HttpOnly and SameSite=Lax, and the
database holds the SHA-256 digest of that token. The cookie lives for seven
days.

The cost: a token that is lost cannot be recovered, and the session table
grows with every sign-in.

### A write must carry its own origin

Every POST, PUT, PATCH and DELETE has to carry an `Origin` header that
matches the origin of the request. The check sits in one middleware in
`app/server/index.ts`, above the routes.

The cost: a client that cannot send an origin cannot write. That is the
point, and it is why the API is not callable from a page on another site.

### The body limit belongs to the route

The limit is set per route, and the routes that may carry a file are the
ones listed in `app/server/upload-limits.ts`. Anything else has to be JSON.

The cost: a new upload route has to be added to that list, and a limit that
is set in the middleware rather than in the route applies to the wrong
route.

### The password is scrypt and the tokens are SHA-256

`hashPassword()` derives the key with scrypt at N=16384, r=8, p=5 and a
32-byte salt, and `verifyPassword()` compares without an early exit. The
session tokens and the invite tokens are digested with SHA-256.

The cost: scrypt at these parameters is slow on purpose, and the login
route is rate limited by the address, by the account and by the email.

### The background jobs live in the Node build

A minute job delivers the notifications and takes the daily backup, and a
job every 15 seconds sweeps the appointment reminders and the queued
notices. Both timers are unref'd, so the process can stop without waiting
for them.

The cost: the Worker build has no timers, so the jobs that belong to a
long-lived process have to be driven from somewhere else.

### The clinical data never reaches the local storage

The service worker caches the shell and the static assets, and the API
answers with `Cache-Control: no-store`.

The cost: the application cannot be read offline after the first load, and
the cache cannot be used to answer a clinical question.

## Boundaries

- `app/src/` and `app/server/` share the types in `app/src/shared.ts` and
  nothing else. The client never reaches into the server's tables.
- `app/server/db.ts` owns the SQL. The route modules call `one`, `many`
  and `run` and do not prepare statements themselves.
- `app/server/auth.ts` owns the hashing. A route that needs a digest asks
  for one and never hashes anything itself.
- `app/server/upload-limits.ts` is the only place that decides what may be
  uploaded and how large it may be.
- `app/server/sqlite.ts` owns the migrations and the adapter. It knows
  nothing about the routes.
- `app/server/node.ts` is the only file that knows about `node:http`, the
  static files and the timers.
