-- ---------------------------------------------------------------------------
-- The marking sheet gets its sections.
--
-- The rubric shipped as five broad criteria invented from the form's own
-- headings. The official sheet — "Evaluation Criteria – BizTech Ideation Pitch",
-- School of Business Studies, Semester 2 2026 — is twenty-seven lines under
-- eight sections, totalling one hundred marks. Assessors mark on paper during
-- the pitch and type the sheet up afterwards, so the screen has to be the same
-- form in the same order; a heading is the difference between transcribing and
-- translating.
-- ---------------------------------------------------------------------------

-- Defaults only so the column can be added to a table that already has rows;
-- dropped immediately, because every row written from here on names its own
-- section and a silent fallback would hide a rubric that was seeded wrong.
ALTER TABLE "review_criteria"
  ADD COLUMN "groupCode" TEXT NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "groupName" TEXT NOT NULL DEFAULT 'Assessment';

ALTER TABLE "review_criteria"
  ALTER COLUMN "groupCode" DROP DEFAULT,
  ALTER COLUMN "groupName" DROP DEFAULT;

-- ---------------------------------------------------------------------------
-- Retire the placeholder rubric.
--
-- `getRubric` seeds a year from the template only when that year has no active
-- criteria, so the old five rows would otherwise shadow the real sheet forever
-- and no cohort would ever be marked against the official criteria.
--
-- Deactivated rather than deleted, for the reason nothing else here is deleted
-- either: a `scores` row may already point at one of these criteria, and the
-- trail of what a panel actually did has to survive a change to what they
-- should have been doing. `summariseScores` ignores marks against a criterion
-- that is no longer on the rubric, so a stale card stops counting without
-- taking its history with it.
-- ---------------------------------------------------------------------------
UPDATE "review_criteria"
   SET "isActive" = false,
       "updatedAt" = CURRENT_TIMESTAMP
 WHERE "isActive" = true
   AND "code" IN ('PROBLEM', 'INNOVATION', 'PROTOTYPE', 'IMPACT', 'VIABILITY');
