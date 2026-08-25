-- 0039_listing_flags.sql
-- Two new listing flags for the RU market:
--   allow_non_rf   — "Можно не РФ" (non-Russian citizens welcome)
--   allow_children — "Можно с детьми" (children welcome)
-- Booleans, default false, surfaced on the create form, the listing tile, the
-- listing detail page, and the Browse filters. Apply by hand in the Supabase
-- SQL editor.

alter table public.listings
  add column if not exists allow_non_rf boolean not null default false,
  add column if not exists allow_children boolean not null default false;
