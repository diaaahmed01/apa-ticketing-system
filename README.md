# ATS - APA Ticketing System

ATS is the ticketing system for the Port of Alexandria. Port support staff and the vendor team raise bugs and change requests against the port's systems, and each ticket moves through a fixed workflow: work, code review, testing, deployment and production verification. Roles and permissions are configurable, people get in-app and email notifications, and a dashboard shows where tickets stand.

## Stack

- Backend: Spring Boot 3.2.5, Java 21, Hibernate 6, Oracle (`backend/`, package `com.apa.ats`)
- Frontend: Next.js 15.5, React 19, TypeScript (`frontend/`)
- Authentication: local accounts, JWT in an HTTP-only `ATS_SESSION` cookie

## Repository layout

```
backend/    Spring Boot API
  src/main/resources/application.yml   all settings, read from environment variables
  src/main/resources/db/ats/           versioned SQL migrations (V001, V002, ...)
frontend/   Next.js app (browser talks only to this; /api is proxied to the backend)
mockups/    design mockups
```

## Prerequisites

- JDK 21 and Maven
- Node.js 20 or newer
- An Oracle database reachable from the backend

## Backend environment variables

Defaults are in `backend/src/main/resources/application.yml`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `ATS_PORT` | `8095` | HTTP port of the API |
| `ATS_DB_HOST` | `10.0.11.56` | Oracle host |
| `ATS_DB_PORT` | `1521` | Oracle port |
| `ATS_DB_SERVICE` | `intgtest` | Oracle service name |
| `ATS_DB_USER` | `SIMW` | Database user (schema) |
| `ATS_DB_PASSWORD` | empty | Database password. No default; always set it |
| `ATS_DB_MIGRATE` | `true` | Run pending migrations at startup |
| `ATS_JWT_SECRET` | empty | Key that signs session tokens. **Required in production** (see below) |
| `ATS_COOKIE_SECURE` | `false` | Send the session cookie over HTTPS only. Set `true` in production |
| `ATS_CORS_ORIGINS` | `http://localhost:3010` | Allowed browser origins, comma separated |
| `ATS_ADMIN_USERNAME` | `admin` | Username of the first administrator |
| `ATS_ADMIN_EMAIL` | empty | Email of the first administrator |
| `ATS_ADMIN_INITIAL_PASSWORD` | empty | First administrator's password. If blank, a random one is generated and printed once in the log |
| `ATS_ATTACHMENTS_DIR` | `./data/attachments` | Folder for uploaded files (relative paths resolve against the backend's working directory) |
| `ATS_ATTACHMENTS_MAX_MB` | `20` | Largest single attachment, in MB |
| `ATS_ATTACHMENTS_MAX_REQUEST_MB` | `100` | Largest upload request (several files at once), in MB |
| `ATS_PUBLIC_URL` | `http://localhost:3010` | Address users open ATS at; used for links inside emails |
| `ATS_MAIL_ENABLED` | `false` | Send queued emails. While `false` they wait in the outbox |
| `ATS_MAIL_HOST` | empty | SMTP server |
| `ATS_MAIL_PORT` | `25` | SMTP port |
| `ATS_MAIL_FROM` | empty | Sender address |
| `ATS_MAIL_USERNAME` | empty | SMTP login. Leave blank for no login |
| `ATS_MAIL_PASSWORD` | empty | SMTP password |
| `ATS_MAIL_STARTTLS` | `false` | Use STARTTLS |

Generate a JWT secret of at least 64 random bytes, base64 encoded:

```
openssl rand -base64 64
```

Keep it out of source control. Changing it signs everyone out.

## Frontend environment variable

| Variable | Default | Meaning |
| --- | --- | --- |
| `ATS_API_URL` | `http://127.0.0.1:8095` | Where the frontend forwards `/api/*` requests (see `frontend/next.config.mjs`). It is read when `next build` or `next dev` starts, so set it before building |
| `NEXT_DIST_DIR` | `.next` | Optional build output folder (for example `.next-prod`) |

## Build and run

Backend:

```
cd backend
mvn -DskipTests package
java -jar target/ats-backend.jar
```

`backend/run-local.sh` starts the jar for local development.

Frontend, development (port 3010):

```
cd frontend
npm install
npm run dev
```

Frontend, production:

```
cd frontend
npm install
npm run build      # next build
npm run start      # next start -p 3010
```

The browser only talks to the frontend. Next.js forwards `/api/*` to the backend through the rewrite in `next.config.mjs`, so the session cookie stays on one origin. Put HTTPS in front of the frontend (for example a reverse proxy) and set `ATS_PUBLIC_URL`, `ATS_CORS_ORIGINS` and `ATS_COOKIE_SECURE` to match.

The `npm` scripts in `frontend/package.json` call the bundled Node under `.tools/` on the development machine. On a server, run the same commands with its own Node: `node node_modules/next/dist/bin/next build`, then `node node_modules/next/dist/bin/next start -p 3010`.

## Database

- All tables, sequences and indexes are prefixed `ATS_` and live in a shared schema.
- Hibernate never changes the schema (`ddl-auto: none`). Migrations are the numbered scripts in `backend/src/main/resources/db/ats`.
- At startup the backend applies any script not yet recorded in `ATS_SCHEMA_HISTORY`, in order.
- Never edit a migration that has been applied. Add a new, higher-numbered script instead.
- The Settings page (Administration) shows the latest applied version.

## First login

On the first start with an empty `ATS_USERS` table the backend creates the administrator (`ATS_ADMIN_USERNAME`, default `admin`). If `ATS_ADMIN_INITIAL_PASSWORD` is blank, a random password is printed once in the backend log. The administrator must choose a new password at first sign-in. Then create users and assign roles under Administration, User Management.

## Workflow

Statuses, in order: Open, In Progress, Code Review, Testing, Ready for Deployment, Deployed, Production Verification, Closed. Blocked sits outside this line.

- Start work needs an assignee.
- Submitting for review needs a reviewer, and the reviewer and tester must be different people.
- The reviewer and the tester can never be one of the people who contributed code.
- The reviewer approves (moves to Testing) or rejects (back to In Progress, reason required). A permitted user can skip review with a reason.
- The tester passes (continues) or fails (back to In Progress, reason required). Ready for Deployment needs a passed test.
- Marking deployed needs a patch reference; it then moves straight to Production Verification.
- Verification passing closes the ticket as Resolved. Failing closes it as Unresolved and creates a follow-up ticket.
- A ticket can be cancelled (Cancelled) or closed unresolved at any time, with a reason.
- Blocking a ticket needs a reason and what it is waiting for (another ticket or a patch). Unblocking returns it to where it was.
- Who may do each step is set per role under Administration, Roles and Permissions. These rules apply whatever the grants say.

## Production checklist

- [ ] Set `ATS_JWT_SECRET` to a generated 64+ byte base64 value.
- [ ] Serve ATS over HTTPS and set `ATS_COOKIE_SECURE=true`.
- [ ] Set `ATS_PUBLIC_URL` and `ATS_CORS_ORIGINS` to the real address.
- [ ] Set `ATS_DB_PASSWORD` and the other `ATS_DB_*` values.
- [ ] Configure SMTP (`ATS_MAIL_*`, then `ATS_MAIL_ENABLED=true`) and check it with Send a test email on the Settings page.
- [ ] Put `ATS_ATTACHMENTS_DIR` on storage that is backed up, together with the database.
- [ ] Deactivate the test users `test.reviewer` and `test.tester`.
- [ ] Change the first administrator's password and keep the initial password out of logs and documents.
