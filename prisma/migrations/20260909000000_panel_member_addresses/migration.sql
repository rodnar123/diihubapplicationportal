-- ---------------------------------------------------------------------------
-- Panel members from outside the university.
--
-- The original rule was that only an official PNGUoT address may hold an
-- account. That was true while every account was a way in: "who may hold an
-- account" and "who may sign in" were the same question, so one constraint
-- answered both.
--
-- They are no longer the same question. A visiting judge, and a lecturer who
-- marks on paper and hands the sheet to the office, both need a row that owns a
-- scorecard; neither needs to authenticate. The judge's address is a company or
-- a personal one, and the old rule made recording them impossible at all.
--
-- Students and administrators keep the old rule exactly. Only a reviewer may
-- hold an outside address, because a reviewer is the only role that can exist
-- without ever signing in.
--
-- This does not widen who may sign in, and is not what was guarding it:
-- `evaluateEmailPolicy` admits the two university domains and refuses every
-- other, before any of this is reached. A reviewer with an outside address gets
-- a scorecard and no way in, which is the whole point.
--
-- The reviewer pattern is deliberately looser than `hasValidEmailShape` in the
-- application, which rejects first with something a human can act on. This is
-- the backstop, so it only has to be tight enough that nothing absurd lands in
-- the column.
-- ---------------------------------------------------------------------------

ALTER TABLE "users" DROP CONSTRAINT "users_email_pnguot_domain_check";

ALTER TABLE "users"
  ADD CONSTRAINT "users_email_pnguot_domain_check"
  CHECK (
    "email" ~ '^[^@[:space:]]+@student\.pnguot\.ac\.pg$'
    OR "email" ~ '^[^@[:space:]]+@pnguot\.ac\.pg$'
    OR (
      "role"::text = 'REVIEWER'
      AND "email" ~ '^[a-z0-9][a-z0-9._%+-]*@[a-z0-9.-]+\.[a-z]{2,}$'
    )
  );
