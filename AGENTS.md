# AGENTS.md — agent context for `doktor-ryadom`

A web app where a patient keeps a wellbeing diary between appointments and a doctor reads it before the next session. React 19 and Mantine on the front, a Hono API over one SQLite file, shipped as a single Docker container behind a Caddy proxy that also serves other projects.

This file is what you need to work on the project without reading all of it.

## Run / build / test

```bash
cd app
npm ci                 # install
npm run db:migrate     # apply app/drizzle/*.sql to the local D1
npm run dev:server     # Wrangler on http://localhost:8787, the API and a local D1
npm run dev            # Vite, proxying /api to Wrangler, in a second terminal
npm run check          # tsc --noEmit
npm test               # vitest
npm run build          # typecheck, client build, worker bundle
npm run build:docker   # the same, plus the Node bundle for the container
npm run start:docker   # node dist/node/server.mjs
```

Node 22. The browser scenarios in `app/tests/` need `npm run build` first, and they use the system Chromium when there is one, otherwise the Playwright build (`npx playwright install chromium`). `CHROME_EXECUTABLE` points them at a specific binary.

Two more commands, the first one from `app/`:

```bash
node scripts/integration.mjs   # end-to-end over HTTP, needs a running Wrangler
docker compose up -d --build   # the container the server runs, from the root
```

CI runs `bandit` over `app/scripts`, the type check, the client build, `vitest`, and a `docker build`.

## Where things live

| Path | What it holds |
| --- | --- |
| `app/src/` | The React client. One file per screen, plus the shared schemas in `shared.ts`. |
| `app/server/index.ts` | The routes, the session check, the role checks, the body limits, the patient and doctor data assembly. |
| `app/server/node.ts` | The Node adapter for Docker: `node:http`, `node:sqlite`, the static files, the background jobs. |
| `app/server/sqlite.ts` | The D1-shaped adapter over `node:sqlite`, and the migration runner with the per-file checksum. |
| `app/server/account.ts` | Password reset, recovery codes, the second factor, the export and the account deletion. |
| `app/server/care.ts` | The goals, the drafts, the questionnaire answers, the medication log, the follow-up notes. |
| `app/server/booking.ts` | The doctor's slots, the patient's requests, the visit events. |
| `app/server/directory.ts` | The catalogue of verified specialists and the reviews. |
| `app/server/jobs.ts`, `app/server/notices.ts` | The background work: reminders, the queued notices, the daily backup, the visit sweep. |
| `app/db/schema.ts` | The Drizzle schema. |
| `app/drizzle/` | The migrations, plain SQL, applied in order. |
| `app/tests/` | The vitest suite, the D1 test adapter, and the Playwright browser scenarios. |
| `app/scripts/` | Backup, off-site copy, restore check, admin, specialist verification, integration. |
| `demo/` | The two demo videos, their compositions, the transcripts and the poster build. |
| `deploy/` | The Caddy fragment and the script that adds it to the shared Caddyfile. |
| `docs/` | The methodology per screen, the reviews, the QA notes, the screenshots, the pilot plan. |

## Traps

- **The API is written once and runs on three databases.** `app/server/index.ts` speaks the D1 interface. `app/server/sqlite.ts` implements it over `node:sqlite` for Docker, and `app/tests/db-adapter.ts` implements it again for the tests. A new query has to work on all three, so the D1 dialect is the one to write against.
- **An applied migration cannot be edited.** The Node runner keeps a SHA-256 checksum of every migration it has applied and refuses to start when a file has changed since. Add a new numbered file under `app/drizzle/` instead.
- **The interface is Russian and the identifiers are English.** Every string a user reads is Russian; table names, column names, route names and variables are English. Keep the split when you add a screen.
- **Writes need an `Origin` header that matches.** GET is open. POST, PUT, PATCH and DELETE are refused with 403 when the header is missing or points elsewhere, and a request without `application/json` on one of those routes is refused with 415. A test that forgets the header looks like a routing bug.
- **Only the routes in `app/server/upload-limits.ts` may carry a file.** Everything else has to be JSON. A new upload route goes into that file with its MIME types and its byte limit, or the request is turned away before the handler runs.
- **The clinician's own notes never reach the patient.** `patientFollowup()` in `app/server/index.ts` strips `complaints`, `objective`, `dynamicsNote`, `diagnosis` and `visitAt` from what the patient reads. A new field on a follow-up has to be added to that list, or it leaks to the wrong side.
- **Only a verified psychiatrist may prescribe.** `canPrescribe()` in `app/src/shared.ts` checks the role, the verification timestamp and the specialty kind together. The server refuses the write and the interface hides the form; both halves of that rule have to move together.
- **A second factor is a precondition, not a preference.** Every `/api/*` route except the setup routes answers 403 with `totp_required` for a doctor or an administrator who has not turned the code on. A spent TOTP step is refused as well, so a code that was seen on a screen cannot be replayed.
- **The patient list is ordered by attention in SQL.** Unacknowledged distress signals first, then PHQ-9 item 9, then the count of unread items, then the name. A new kind of signal needs a column in that order, in the query.
- **A second tap on the distress signal inside a minute is the same event.** The server keeps one row, so the doctor gets one notification rather than two.
- **The database runs in WAL mode, so a backup is not a copy of the file.** The daily backup uses `VACUUM INTO`, checks `integrity_check` and `foreign_key_check`, and only then renames the file into place.
- **Push endpoints are allowlisted.** `allowedPushEndpoint()` accepts the FCM, Mozilla and Apple push hosts over HTTPS, with no port and no credentials in the URL. Anything else is refused when it subscribes.

## Style / safety rails

- **Comments explain *why*, never *what*.** The comments in this codebase are unusually good on this point. Keep them that way.
- **The interface stays Russian.** The code, the comments and the commit messages keep the language they are in. The documents are English.
- **No emoji**, in any file. The house style bans them.
- **Never add a diagnosis, a score or a risk level.** The thresholds in `attentionRules` in `app/src/shared.ts` are working values that no psychiatrist has checked, and the code says so in a comment.
- **The clinical wording is unvalidated.** `docs/review/clinical-wording.md` lists the open questions about the questions, the scales and the practices. A change to any of them needs a psychiatrist, not a guess.
- **Do not remove the `Origin` check or the role guards to make a test pass.**
- **Do not change the deployment target.** One container, SQLite on a volume, and a Caddyfile that other projects share.
- **Do not edit a migration that has already been applied.**

## Where the product truth lives

`PRODUCT.md` holds it. Read it before changing what the product says about itself, and write the change there when the behaviour changes.
