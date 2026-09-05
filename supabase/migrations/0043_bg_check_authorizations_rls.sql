-- 0043_bg_check_authorizations_rls.sql
-- Enable Row-Level Security on public.bg_check_authorizations.
--
-- This table was created in 0013 WITHOUT row-level security. Supabase flags that
-- as rls_disabled_in_public: with RLS off, anyone holding the anon/public API key
-- (which ships in the browser bundle) can read, edit, and delete every row.
--
-- All application access to this table is via the service-role client
-- (createAdminClient in src/lib/backgroundCheckPayments.ts and the background
-- routes). The service role BYPASSES RLS, so turning RLS on with NO policies
-- locks the table to server-side only — anon/authenticated are denied, the
-- service role keeps working, and nothing in the app breaks.
--
-- Apply by hand in the Supabase SQL editor.

alter table public.bg_check_authorizations enable row level security;

-- Deliberately no policies: only the RLS-bypassing service role may touch this
-- table. If client-side (anon/authenticated) access is ever required, add explicit
-- policies here rather than disabling RLS.
