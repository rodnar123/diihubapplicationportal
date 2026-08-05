-- Defence-in-depth constraints and search support.
--
-- Everything here is also enforced in the application layer. It is repeated at
-- the database level so that a bug, a manual query, or a future service cannot
-- put the table into a state the domain considers impossible.

-- ---------------------------------------------------------------------------
-- 1. Only official PNGUoT addresses may hold an account.
--    Students:  <something>@student.pnguot.ac.pg
--    Staff:     <something>@pnguot.ac.pg
-- ---------------------------------------------------------------------------
ALTER TABLE "users"
  ADD CONSTRAINT "users_email_pnguot_domain_check"
  CHECK (
    "email" ~ '^[^@[:space:]]+@student\.pnguot\.ac\.pg$'
    OR "email" ~ '^[^@[:space:]]+@pnguot\.ac\.pg$'
  );

-- Emails are always persisted lower-cased; enforce it rather than trusting it.
ALTER TABLE "users"
  ADD CONSTRAINT "users_email_lowercase_check"
  CHECK ("email" = lower("email"));

-- ---------------------------------------------------------------------------
-- 2. A student may hold at most one live application per challenge year.
--    Partial index so that a soft-deleted application does not block a
--    genuine restart, and withdrawn entries free the slot again.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "applications_one_live_per_owner_per_year"
  ON "applications" ("ownerId", "challengeYear")
  WHERE "deletedAt" IS NULL AND "status" <> 'WITHDRAWN';

-- ---------------------------------------------------------------------------
-- 3. Team names are compared case-insensitively when detecting duplicates.
--    (Uniqueness itself is scoped to a challenge year, which lives on the
--    parent application, so it is enforced in the application layer inside the
--    same transaction as the write. This index makes that check cheap.)
-- ---------------------------------------------------------------------------
CREATE INDEX "teams_name_lower_idx" ON "teams" (lower("name")) WHERE "deletedAt" IS NULL;

-- A student may appear on only one live team per challenge year. Enforced in
-- the application layer for the same cross-table reason; indexed here.
CREATE INDEX "team_members_student_id_lower_idx"
  ON "team_members" (lower("studentId"))
  WHERE "deletedAt" IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Fuzzy search across the fields the admin console searches on.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "applications_project_title_trgm_idx"
  ON "applications" USING gin ("projectTitle" gin_trgm_ops);

CREATE INDEX "applications_reference_number_trgm_idx"
  ON "applications" USING gin ("referenceNumber" gin_trgm_ops);

CREATE INDEX "teams_name_trgm_idx"
  ON "teams" USING gin ("name" gin_trgm_ops);

CREATE INDEX "users_name_trgm_idx"
  ON "users" USING gin ("name" gin_trgm_ops);

CREATE INDEX "users_email_trgm_idx"
  ON "users" USING gin ("email" gin_trgm_ops);

CREATE INDEX "student_profiles_student_id_trgm_idx"
  ON "student_profiles" USING gin ("studentId" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 5. A submitted application must carry a reference number, and an approved or
--    rejected one must carry a decision timestamp.
-- ---------------------------------------------------------------------------
ALTER TABLE "applications"
  ADD CONSTRAINT "applications_submitted_has_reference_check"
  CHECK (
    "status" = 'DRAFT'
    OR "deletedAt" IS NOT NULL
    OR ("referenceNumber" IS NOT NULL AND "submittedAt" IS NOT NULL)
  );

ALTER TABLE "applications"
  ADD CONSTRAINT "applications_decided_has_reviewer_check"
  CHECK (
    "status" NOT IN ('APPROVED', 'REJECTED')
    OR "reviewedAt" IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- 6. Uploaded files must have a positive size; guards against zero-byte
--    placeholder rows created by an interrupted upload.
-- ---------------------------------------------------------------------------
ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_size_positive_check"
  CHECK ("sizeBytes" > 0);
