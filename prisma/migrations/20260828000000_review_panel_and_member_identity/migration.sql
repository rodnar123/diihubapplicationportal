-- Review panel (rubric, assignment, scoring) and team-member identity.
--
-- Purely additive: three new tables, one new enum, one nullable column and its
-- index. Nothing existing is dropped, narrowed or rewritten, so this is safe to
-- apply to a cohort that is already mid-cycle.

-- ---------------------------------------------------------------------------
-- 1. Where one reviewer has got to with one application.
-- ---------------------------------------------------------------------------
CREATE TYPE "ReviewAssignmentStatus" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'SUBMITTED',
  'RECUSED'
);

-- ---------------------------------------------------------------------------
-- 2. The marking rubric.
--
--    Versioned by challenge year: editing next cycle's criteria must not
--    retroactively rescore a cohort that has already been decided.
-- ---------------------------------------------------------------------------
CREATE TABLE "review_criteria" (
  "id"            TEXT NOT NULL,
  "code"          TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "description"   TEXT,
  "weight"        INTEGER NOT NULL DEFAULT 1,
  "maxValue"      INTEGER NOT NULL DEFAULT 5,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"     INTEGER NOT NULL DEFAULT 0,
  "challengeYear" INTEGER NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "review_criteria_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "review_criteria_challengeYear_code_key"
  ON "review_criteria" ("challengeYear", "code");

CREATE INDEX "review_criteria_challengeYear_isActive_sortOrder_idx"
  ON "review_criteria" ("challengeYear", "isActive", "sortOrder");

-- A criterion nobody can score against is a configuration mistake, not a
-- degenerate case worth supporting.
ALTER TABLE "review_criteria"
  ADD CONSTRAINT "review_criteria_max_value_positive_check"
  CHECK ("maxValue" > 0);

ALTER TABLE "review_criteria"
  ADD CONSTRAINT "review_criteria_weight_positive_check"
  CHECK ("weight" > 0);

-- ---------------------------------------------------------------------------
-- 3. Who is expected to look at what.
-- ---------------------------------------------------------------------------
CREATE TABLE "review_assignments" (
  "id"            TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "reviewerId"    TEXT NOT NULL,
  "status"        "ReviewAssignmentStatus" NOT NULL DEFAULT 'PENDING',
  "submittedAt"   TIMESTAMP(3),
  "recusedReason" TEXT,
  "assignedById"  TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  "deletedAt"     TIMESTAMP(3),

  CONSTRAINT "review_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "review_assignments_applicationId_reviewerId_idx"
  ON "review_assignments" ("applicationId", "reviewerId");

CREATE INDEX "review_assignments_reviewerId_status_idx"
  ON "review_assignments" ("reviewerId", "status");

CREATE INDEX "review_assignments_deletedAt_idx"
  ON "review_assignments" ("deletedAt");

-- One live allocation per reviewer per application. Partial, so withdrawing an
-- allocation and re-making it later is possible — which is what happens when
-- work is reshuffled between panel members.
CREATE UNIQUE INDEX "review_assignments_one_live_per_reviewer"
  ON "review_assignments" ("applicationId", "reviewerId")
  WHERE "deletedAt" IS NULL;

-- A recusal must say why. Without this the difference between "stepped away
-- for a declared conflict" and "never got round to it" is invisible, and it is
-- exactly the difference an appeal turns on.
ALTER TABLE "review_assignments"
  ADD CONSTRAINT "review_assignments_recusal_has_reason_check"
  CHECK (
    "status" <> 'RECUSED'
    OR ("recusedReason" IS NOT NULL AND length(btrim("recusedReason")) > 0)
  );

-- A committed review carries the instant it was committed.
ALTER TABLE "review_assignments"
  ADD CONSTRAINT "review_assignments_submitted_has_timestamp_check"
  CHECK ("status" <> 'SUBMITTED' OR "submittedAt" IS NOT NULL);

ALTER TABLE "review_assignments"
  ADD CONSTRAINT "review_assignments_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "applications" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "review_assignments"
  ADD CONSTRAINT "review_assignments_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "users" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "review_assignments"
  ADD CONSTRAINT "review_assignments_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "users" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. The marks themselves.
-- ---------------------------------------------------------------------------
CREATE TABLE "scores" (
  "id"           TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "criterionId"  TEXT NOT NULL,
  "value"        INTEGER NOT NULL,
  "comment"      TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "scores_assignmentId_criterionId_key"
  ON "scores" ("assignmentId", "criterionId");

CREATE INDEX "scores_criterionId_idx" ON "scores" ("criterionId");

-- A mark is never negative. The upper bound is per-criterion and so cannot be
-- expressed as a column CHECK; it is enforced in the domain and re-checked in
-- the trigger below, which is the only way a raw UPDATE cannot get around it.
ALTER TABLE "scores"
  ADD CONSTRAINT "scores_value_not_negative_check"
  CHECK ("value" >= 0);

ALTER TABLE "scores"
  ADD CONSTRAINT "scores_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "review_assignments" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scores"
  ADD CONSTRAINT "scores_criterionId_fkey"
  FOREIGN KEY ("criterionId") REFERENCES "review_criteria" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- The upper bound lives on the criterion, so it needs a lookup rather than a
-- column CHECK. Defence in depth: the domain rejects an out-of-range mark long
-- before it reaches here, and this stops a bug or a manual query storing a 9
-- against a criterion marked out of 5 — which would silently distort every
-- ranking that criterion appears in.
CREATE OR REPLACE FUNCTION "scores_value_within_criterion_max"()
RETURNS TRIGGER AS $$
DECLARE
  "limit_value" INTEGER;
BEGIN
  SELECT "maxValue" INTO "limit_value"
  FROM "review_criteria"
  WHERE "id" = NEW."criterionId";

  IF "limit_value" IS NOT NULL AND NEW."value" > "limit_value" THEN
    RAISE EXCEPTION
      'score % exceeds the maximum of % for criterion %',
      NEW."value", "limit_value", NEW."criterionId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "scores_value_within_criterion_max_trigger"
  BEFORE INSERT OR UPDATE ON "scores"
  FOR EACH ROW EXECUTE FUNCTION "scores_value_within_criterion_max"();

-- ---------------------------------------------------------------------------
-- 5. Team-member identity.
--
--    `studentId` is typed by the team leader from memory, so the
--    "one student, one team" rule can only compare strings and a typo defeats
--    it. This column is the real identity, linked when the named student signs
--    in and their profile's student number matches the roster line.
-- ---------------------------------------------------------------------------
ALTER TABLE "team_members" ADD COLUMN "userId" TEXT;

CREATE INDEX "team_members_userId_idx" ON "team_members" ("userId");

ALTER TABLE "team_members"
  ADD CONSTRAINT "team_members_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- A claimed account appears on at most one live team per challenge year. The
-- year lives on the parent application, two joins away, so this cannot be a
-- single-table constraint — but the identity half *can* be indexed, which is
-- what makes the application-layer check cheap.
CREATE INDEX "team_members_user_live_idx"
  ON "team_members" ("userId")
  WHERE "deletedAt" IS NULL AND "userId" IS NOT NULL;
