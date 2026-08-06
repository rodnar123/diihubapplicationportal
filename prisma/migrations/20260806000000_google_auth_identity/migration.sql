-- Authentication moved from Supabase Auth (magic link) to NextAuth + Google
-- OAuth. Supabase is still used for Storage, but it no longer issues sessions,
-- so the column that pointed at `auth.users` now holds Google's `sub` claim.
--
-- Renamed rather than dropped and re-added so that any existing rows keep their
-- identity link; the value is re-written on the user's next sign-in either way.

ALTER TABLE "users" RENAME COLUMN "supabaseUserId" TO "authProviderId";

ALTER INDEX "users_supabaseUserId_key" RENAME TO "users_authProviderId_key";

-- Existing links point at Supabase user ids, which mean nothing to Google.
-- Clearing them lets the unique index accept the real subject on next sign-in
-- instead of colliding with a stale value.
UPDATE "users" SET "authProviderId" = NULL;
