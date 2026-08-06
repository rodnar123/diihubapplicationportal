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
| Auth | NextAuth v5 (Auth.js) + Google OAuth, with Prisma-owned roles |
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
- **Authentication ≠ authorisation.** Google proves who someone is; the `users`
  table decides what they may do. A role is never read from a token claim, so
  it cannot be forged — and revoking access takes effect on the next request
  rather than when the session happens to expire.
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

## Google OAuth setup

Sign-in is Google-only. There are no passwords and no magic links.

### 1. Create the OAuth client

**Google Cloud Console → APIs & Services → Credentials → Create credentials →
OAuth client ID → Web application**

- Authorised JavaScript origins: `https://your-domain` (and
  `http://localhost:3000` for development)
- Authorised redirect URIs — this must match exactly:
  ```
  https://your-domain/api/auth/callback/google
  http://localhost:3000/api/auth/callback/google
  ```

Copy the client ID and secret into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

Generate the session-signing secret with:

```bash
npx auth secret
```

### 2. Domain restriction

The authorisation request carries `hd=*`, which asks Google to show only
Workspace accounts in the chooser. **That is a hint, not a control** — `hd` can
be stripped from the URL by anyone who cares to. The rule is enforced in
`src/auth.ts`'s `signIn` callback, which:

1. rejects an address Google reports as unverified;
2. requires the domain to be `@student.pnguot.ac.pg` (students) or
   `@pnguot.ac.pg` (staff);
3. hands off to `provisionUser`, which additionally refuses staff addresses
   that are not on the admin allowlist.

The database `CHECK` constraint on `users.email` is the final backstop. A
personal Gmail account cannot get past any of these layers.

> If the university publishes its Workspace domains as something other than
> these two, change `NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN` / `STAFF_EMAIL_DOMAIN`
> **and** the `CHECK` constraint in
> `prisma/migrations/20260101000100_constraints_and_search_indexes/`.

---

## Supabase setup

Supabase provides **the database and file storage only** — it no longer issues
sessions, and there is no browser-side Supabase client.

### 1. Create the storage bucket

**Storage → New bucket**

- Name: `application-attachments`
- **Public: off.** This matters — every download goes through
  `/api/attachments/[id]`, which authorises the caller and then mints a
  120-second signed URL. A public bucket would make every uploaded file
  reachable by anyone who guesses a path.

No RLS policies are needed on the bucket: the app reaches storage only through
the service-role key, from server code that has already checked permission.

### 2. Connection strings

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
| `AUTH_SECRET` | ✅ | Signs the session JWT (`npx auth secret`) |
| `AUTH_GOOGLE_ID` | ✅ | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | ✅ | Google OAuth client secret |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL (storage) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-only. Storage access. **Never expose.** |
| `SUPABASE_STORAGE_BUCKET` | | Defaults to `application-attachments` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Absolute base URL — used in email links and the OAuth redirect |
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
| `User` | Identity + role. `authProviderId` holds Google's `sub` claim. |
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

Three migrations ship:

1. `20260101000000_init` — tables, enums, foreign keys, indexes.
2. `20260101000100_constraints_and_search_indexes` — defence in depth:
   - `CHECK` that every email is a `@student.pnguot.ac.pg` or `@pnguot.ac.pg`
     address, stored lower-cased.
   - Partial unique index: one live application per student per challenge year.
   - `pg_trgm` GIN indexes backing the admin search.
   - `CHECK` that a submitted application carries a reference number, that a
     decided one carries a decision timestamp, and that attachments are non-empty.
3. `20260806000000_google_auth_identity` — renames `supabaseUserId` to
   `authProviderId` and clears stale values, following the move to Google OAuth.

```bash
npm run db:migrate    # development — create and apply
npm run db:deploy     # production — apply only
npm run db:reset      # drop, re-migrate, re-seed (destructive)
npm run db:studio     # browse the data
```

---

## Accounts and roles

Three roles: `STUDENT`, `REVIEWER`, `ADMIN`.

**Students self-register.** Any `@student.pnguot.ac.pg` Google account can sign
in and is provisioned automatically on first use.

**Staff do not self-register.** A `@pnguot.ac.pg` account can only sign in if it
is either listed in `ADMIN_EMAIL_ALLOWLIST` or already exists as an active
`ADMIN`/`REVIEWER` row. This stops anyone who happens to hold a university staff
mailbox from reaching the review console.

To add a reviewer who should not be a full administrator:

```sql
INSERT INTO users (id, email, name, role, "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'jane.reviewer@pnguot.ac.pg',
        'Jane Reviewer', 'REVIEWER', now(), now());
```

They can then sign in with Google normally. `ADMIN` additionally unlocks
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
| Identity | Google OAuth (NextAuth v5). No passwords are stored or handled. |
| Domain restriction | `hd` hint + `signIn` callback + `provisionUser` + database `CHECK` |
| RBAC | Role read from Prisma on every request, never from a token claim |
| Route protection | `src/proxy.ts` gates authentication; each layout re-checks role |
| Session | 12-hour signed JWT, HTTP-only cookie; revocation is immediate via the DB role read |
| CSRF | NextAuth state/PKCE on the OAuth flow; Server Actions origin-checked; sign-out is POST-only |
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
    (auth)/sign-in/          Google sign-in
    (student)/               Dashboard + application wizard
    (admin)/                 Review console, settings, audit log
    api/auth/[...nextauth]/  NextAuth OAuth endpoints
    api/                     PDF, attachments, CSV/PDF export
    auth/                    Error page + sign-out route handler
  auth.config.ts             Edge-safe auth config (used by proxy.ts)
  auth.ts                    Full auth config — domain gate + provisioning
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
   must be the real public URL — email links use it.
2. Add `https://<your-domain>/api/auth/callback/google` to the Google OAuth
   client's **Authorised redirect URIs**. It must match byte-for-byte, so if
   you use a custom domain, register that domain rather than the
   `*.vercel.app` deployment URL.
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
- **NextAuth v5 is a beta release.** It is the only version that supports the
  Next.js 16 App Router; v4 does not. The APIs used here (`handlers`, `auth`,
  `signIn`, `signOut`, the `signIn`/`jwt`/`session` callbacks) have been stable
  across the beta series, but pin the version before a release cycle.
- **Sign-in requires a Google account on the university domain.** If a student
  has a PNGUoT mailbox that is not Google Workspace–backed, they cannot sign in.
  Confirm with IT that both domains are on Workspace before go-live.
