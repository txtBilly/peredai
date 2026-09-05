-- 0044_drop_bg_check_authorizations.sql
-- The background-check feature is fully retired (RU market verifies identity via
-- Sber ID / T-ID, not background checks). Remove the now-unused table.
--
-- SAFETY: this is destructive. Before applying, confirm the table is empty (or
-- that you don't need its rows):
--   select count(*) from public.bg_check_authorizations;
--
-- The application code that used this table (src/lib/backgroundCheckPayments.ts,
-- src/app/api/background/*, src/lib/background/*, the background/verify UI) is
-- removed in the same change. The profiles.bg_check_completed_at /
-- bg_check_expires_at columns and the lock_verified_full_name trigger are left in
-- place for now (the trigger references bg_check_completed_at); they are harmless
-- (always null under the identity-only flow) and can be cleaned up separately.
--
-- Apply by hand in the Supabase SQL editor.

drop table if exists public.bg_check_authorizations;
