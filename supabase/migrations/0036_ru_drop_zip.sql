-- 0036_ru_drop_zip.sql
-- Russia market (Peredai): location is no longer derived from a postal index.
-- The `city` column (added in 0031) is now the first-class location field and
-- `cross_streets` is repurposed in copy as "nearest metro / district".
--
-- We keep the `zip` column to avoid a destructive change, but it is no longer
-- required and the app stops writing/reading it. Make it nullable so inserts
-- that omit it succeed.
--
-- Apply by hand in the Supabase SQL Editor (see NEW_MARKET_PLAYBOOK.md §2).
-- "No rows returned" on this DDL is success.

alter table public.listings
  alter column zip drop not null;

-- Backfill/default: ensure every listing has a city; fall back to Москва for any
-- legacy row that somehow lacks one. (New rows always set city from the form.)
update public.listings
  set city = 'Москва'
  where city is null or btrim(city) = '';
