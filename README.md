# PNGUoT Student Challenge Application Portal

Online application portal for the **DiiHub BizTech Challenge**, School of Business
Studies, Papua New Guinea University of Technology.

Students register a team, complete the official application form online, attach
supporting evidence, sign a declaration and submit. Administrators search,
filter, review, decide, print and export.

---

## Contents

- [Stack](#stack)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Supabase setup](#supabase-setup)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Accounts and roles](#accounts-and-roles)
- [Email](#email)
- [Runtime settings](#runtime-settings)
- [Security](#security)
- [Accessibility](#accessibility)
- [Project structure](#project-structure)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Known limitations](#known-limitations)

---

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React 19, Turbopack) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix) |
| Database | PostgreSQL (Supabase) via Prisma 7 + `@prisma/adapter-pg` |
| Auth | Supabase Auth (passwordless email link) + Prisma-owned roles |
| Storage | Supabase Storage (private bucket, signed URLs) |
| Forms | React Hook Form + Zod v4 |
| Tables | TanStack Table v9 |
| Charts | Recharts (via shadcn `chart`) |
| PDF | `@react-pdf/renderer` |
| Rich text | Tiptap 3 |
| Email | Resend (console transport in development) |
| Icons | Lucide React |

---

## Architecture

Layered, with dependencies pointing inward only:

```
src/
  app/            Delivery — routes, layouts, Server Actions, API handlers
  components/     UI — presentational + client interactivity
  domain/         Pure business rules. No I/O, no framework imports.
  services/       Use-cases. Orchestrates domain + infrastructure.
  lib/            Cross-cutting: db client, auth session, errors, env, utils
  generated/      Prisma client (generated; git-ignored)
```

Principles this codebase actually holds to:

- **The domain layer is pure.** `src/domain/**` has no database, no `next/*`, no
  environment access — which is why the same completeness rules run in the
  browser (to grey out the submit button) and on the server (to enforce it).
- **Authentication ≠ authorisation.** Supabase proves who someone is; the
  `users` table decides what they may do. A role is never read from a JWT
  claim, so it cannot be forged by editing a token.
- **Server Actions are thin.** They parse, sanitise, delegate to a service and
  return a typed `ActionResult`. Business rules live in `services/`, not in the
  route.
- **One source of truth per rule.** Status transitions, completeness, upload
  limits and team size each exist once and are consumed by every caller.

---

## Getting started

Requires **Node.js 20+** and a PostgreSQL database (Supabase or local).

```bash
npm install                # also runs `prisma generate`
cp .env.example .env       # then fill in the values
npm run db:deploy          # apply migrations
npm run db:seed            # reference data, settings, demo applications
npm run dev
```

Open <http://localhost:3000>.

> Seeding creates demo students and applications **only** when `NODE_ENV` is not
> `production`, so running it against a live database cannot pollute it.

---

## Supabase setup

Three things need configuring in the Supabase dashboard.

### 1. Restrict sign-ups to university addresses

The portal enforces the domain rule in three places (browser, Server Action,
auth callback) and the database has a `CHECK` constraint as a backstop.

**Authentication → Sign In / Providers → Email**

- Enable the **Email** provider.
- Under **Authentication → URL Configuration**, set:
  - Site URL: `https://your-domain` (or `http://localhost:3000`)
  - Redirect URLs: add `https://your-domain/auth/callback`

### 2. Create the storage bucket

**Storage → New bucket**

- Name: `application-attachments`
- **Public: off.** This matters — every download goes through
  `/api/attachments/[id]`, which authorises the caller and then mints a
  120-second signed URL. A public bucket would make every uploaded file
  reachable by anyone who guesses a path.

No RLS policies are needed on the bucket: the app reaches storage only through
the service-role key, from server code that has already checked permission.

### 3. Connection strings

**Project Settings → Database → Connection string**

- `DATABASE_URL` — the **pooled** (PgBouncer, port `6543`) string, with
  `?pgbouncer=true&connection_limit=1`. Used by the running app.
- `DIRECT_URL` — the **direct** (port `5432`) string. Used by `prisma migrate`,
  which needs advisory locks the transaction pooler cannot provide.

---

## Environment variables

See `.env.example` for the annotated template.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Pooled Postgres connection for the app |
| `DIRECT_URL` | ✅ | Direct connection for migrations |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-only. Storage access. **Never expose.** |
| `SUPABASE_STORAGE_BUCKET` | | Defaults to `application-attachments` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Absolute base URL — used in email links and the auth redirect |
| `NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN` | | Defaults to `student.pnguot.ac.pg` |
| `STAFF_EMAIL_DOMAIN` | | Defaults to `pnguot.ac.pg` |
| `ADMIN_EMAIL_ALLOWLIST` | ✅ | Comma-separated staff addresses granted `ADMIN` |
| `RESEND_API_KEY` | | Omit in development — mail is logged instead |
| `EMAIL_FROM` | | Sender identity |
| `ADMIN_NOTIFICATION_EMAILS` | | Where "new submission" alerts go |

Validation runs at boot (`src/lib/env.ts`, `src/lib/env.server.ts`), so a missing
or malformed value fails immediately with a readable message rather than
surfacing as a confusing runtime error later.

---

## Database

### Schema

Normalised, with soft deletes, timestamps and indexes throughout.

| Model | Purpose |
|---|---|
| `User` | Identity + role. Linked to Supabase `auth.users`. |
| `StudentProfile` | Student number, name, school, section, programme, year |
| `School`, `Section` | Reference data — real FKs so dashboard aggregation is exact |
| `Application` | The form itself, plus workflow state |
| `Team`, `TeamMember` | Team roster (the leader appears as row 1) |
| `Attachment` | Uploaded evidence; storage path, MIME, size, checksum |
| `Declaration` | Electronic or signed-upload, with IP/user-agent capture |
| `StatusHistory` | Every transition, with actor and note |
| `Comment` | Internal notes and shared feedback |
| `Notification` | In-app notifications, with email delivery stamp |
| `AuditLog` | Append-only trail of every state change |
| `AppSetting` | Runtime configuration |

### Migrations

Two migrations ship:

1. `20260101000000_init` — tables, enums, foreign keys, indexes.
2. `20260101000100_constraints_and_search_indexes` — defence in depth:
   - `CHECK` that every email is a `@student.pnguot.ac.pg` or `@pnguot.ac.pg`
     address, stored lower-cased.
   - Partial unique index: one live application per student per challenge year.
   - `pg_trgm` GIN indexes backing the admin search.
   - `CHECK` that a submitted application carries a reference number, that a
     decided one carries a decision timestamp, and that attachments are non-empty.

```bash
npm run db:migrate    # development — create and apply
npm run db:deploy     # production — apply only
npm run db:reset      # drop, re-migrate, re-seed (destructive)
npm run db:studio     # browse the data
```

---

## Accounts and roles

Three roles: `STUDENT`, `REVIEWER`, `ADMIN`.

**Students self-register.** Any `@student.pnguot.ac.pg` address can request a
sign-in link and is provisioned automatically on first use.

**Staff do not self-register.** A `@pnguot.ac.pg` address can only sign in if it
is either listed in `ADMIN_EMAIL_ALLOWLIST` or already exists as an active
`ADMIN`/`REVIEWER` row. This stops anyone who happens to hold a university staff
mailbox from reaching the review console.

To add a reviewer who should not be a full administrator:

```sql
INSERT INTO users (id, email, name, role, "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'jane.reviewer@pnguot.ac.pg',
        'Jane Reviewer', 'REVIEWER', now(), now());
```

They can then request a sign-in link normally. `ADMIN` additionally unlocks
Settings and the Audit log.

Anything not on an institutional domain is refused with the required wording:

> Only official PNG University of Technology student email accounts are permitted.

---

## Email

Without `RESEND_API_KEY`, every message is printed to the server log instead of
being sent — so local development cannot accidentally mail real students.

| Trigger | Recipient |
|---|---|
| Application submitted / re-submitted | Team leader + account address |
| New / revised submission | `ADMIN_NOTIFICATION_EMAILS` |
| Under review, revision requested, approved, rejected | Applicant |
| Shared comment added | Applicant |

All sending is best-effort: a mail failure is logged but never rolls back the
action that triggered it. The in-app `Notification` row is the durable record.

---

## Runtime settings

Administrators change these at **Admin → Settings** with no redeploy:

- Challenge year and the selectable theme list
- Minimum and maximum team size
- Maximum file size, files per application, accepted MIME types
- Declaration mode — electronic, signed upload, or the team's choice
- Submission window (opens / closes) and whether withdrawal is allowed

Each is validated on write, and the *resulting* configuration is checked as a
whole so cross-field rules (min ≤ max, opens before closes) cannot be violated.

---

## Security

| Control | Implementation |
|---|---|
| Domain restriction | Browser + Server Action + auth callback + database `CHECK` |
| RBAC | Role read from Prisma on every request, never from a JWT claim |
| Route protection | `src/proxy.ts` gates authentication; each layout re-checks role |
| CSRF | Server Actions are origin-checked by Next.js; sign-out is POST-only |
| Rate limiting | Sign-in, uploads, submissions, exports, comments |
| Input sanitisation | DOMPurify allowlist on every rich-text and plain-text write |
| XSS | Stored HTML is sanitised on write and rendered from one reviewed path |
| Upload safety | Size + MIME allowlist + **magic-byte signature check** |
| File access | Private bucket; 120-second signed URLs after an authorisation check |
| Open redirect | `next` parameters must be same-origin absolute paths |
| CSV injection | Leading `=`, `+`, `-`, `@` are neutralised in exports |
| Audit trail | Append-only; records actor, IP, user agent and metadata |
| Headers | CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy |
| Secrets | A `server-only` import guard makes server config a build error in client code |

**Known trade-off:** the CSP allows `'unsafe-inline'` for scripts because
Next.js emits an inline bootstrap on every page. Moving to a per-request nonce
means generating it in `proxy.ts` and forfeiting static optimisation; it is
worth doing once the portal sits behind a CDN. Every other directive is locked
down.

**Rate limiting is in-process.** On a multi-instance deployment the effective
limit is `limit × instances`. It sits in front of controls that *are* central
(Supabase Auth throttling, database uniqueness), so it is a speed bump rather
than a quota. Swap the in-memory store for Redis if you need it exact.

---

## Accessibility

Built to WCAG 2.1 AA:

- Labels, descriptions and errors are wired through `aria-describedby` /
  `aria-invalid` by a single `FormRow` wrapper, so no field can be missed.
- Status is conveyed by icon **and** text, never colour alone.
- Skip-to-content link; visible focus rings throughout.
- `prefers-reduced-motion` honoured globally.
- Live regions announce autosave failures and filter result counts.
- Full keyboard operation, including the ⌘K command palette.
- Chart colours were validated for lightness band, chroma floor, colour-vision
  separation and surface contrast, in both light and dark mode. Every chart is
  single-series with direct value labels, so identity never depends on hue.

---

## Project structure

```
prisma/
  schema.prisma              Data model
  migrations/                SQL migrations
  seed.ts                    Reference data, settings, demo applications
src/
  app/
    (auth)/sign-in/          Passwordless sign-in
    (student)/               Dashboard + application wizard
    (admin)/                 Review console, settings, audit log
    api/                     PDF, attachments, CSV/PDF export
    auth/                    Callback + sign-out route handlers
  components/
    application/             Wizard steps, summary, timeline, uploads
    admin/                   Table, filters, charts, review panel, settings
    forms/                   FormRow, rich-text editor, dependent selects
    layout/                  Shell, sidebar, header, command palette
    ui/                      shadcn primitives
  domain/
    application/             Status rules, completeness, schemas, steps
    challenge/               Constants (SDGs, year levels, prototype types)
    identity/                Email policy
    settings/                Settings registry
    rich-text.ts             Pure measurement helpers
  services/
    application/             Draft, submit, withdraw, PDF
    admin/                   Query, statistics, review, CSV export
    identity/                User provisioning
    notifications/           Email transport, templates, notifications
    storage/                 Upload, delete, signed URLs
    audit/                   Audit log
  lib/                       db, auth session, env, errors, rate limit, routes
```

---

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | `prisma generate`, then production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Create + apply a migration (development) |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | Seed reference data and settings |
| `npm run db:reset` | Drop, re-migrate, re-seed (**destructive**) |
| `npm run db:studio` | Prisma Studio |

---

## Deployment

Deploys cleanly to Vercel or any Node host.

1. Set every environment variable from the table above. `NEXT_PUBLIC_APP_URL`
   must be the real public URL — the auth callback and email links use it.
2. Add `<your-domain>/auth/callback` to Supabase's redirect allowlist.
3. Build command: `npm run build` (runs `prisma generate` first).
4. Run `npm run db:deploy` against the production database as a release step.
5. Run `npm run db:seed` **once** to install reference data and settings. In
   production this seeds schools, sections, settings and administrators only.

The bulk PDF export sets `maxDuration = 300`; on Vercel this needs a plan that
allows it, or lower the `MAX_DOCUMENTS` cap in
`src/app/api/admin/applications/export-pdf/route.ts`.

---

## Known limitations

Stated plainly rather than discovered later:

- **Rate limiting is per-instance** (see Security). Fine for a single instance.
- **The CSP permits inline scripts** (see Security).
- **The university crest is a placeholder.** `UniversityCrest` in
  `src/components/brand/university-mark.tsx` draws a stand-in; drop the real
  artwork in `public/` and swap that component and `Crest` in
  `src/lib/pdf/pdf-primitives.tsx`.
- **Bulk PDF export is capped at 100 applications** per request and produces one
  combined document rather than a ZIP of separate files — which is what a panel
  printing a batch actually wants.
- **CSV export is capped at 2000 rows** per request.
- **No automated test suite.** The type system, Zod schemas and database
  constraints carry the correctness load; a test suite was not in scope.
- **Reviewer accounts are provisioned by SQL or the allowlist** — there is no
  user-management screen, since the specification did not call for one.
