-- Availability sweep support (Session: listing lifecycle).
--
-- The daily sweep (/api/listings/sweep-availability) does two things for
-- listings that are still 'active' (i.e. NOT in talks / 'negotiating'):
--   #2  when the move-in date is <= 2 days out, email the lister a one-time
--       nudge (still available? consider lowering the gratitude) — tracked here
--       so it is sent at most once per listing.
--   #3  when the move-in date has arrived, take the listing down ('removed').
--       No slot refund: the yearly limit counts published_at, which is left
--       intact, so the listing stays counted against the 3-per-year cap.
alter table listings
  add column if not exists availability_nudge_sent_at timestamptz;

-- Speeds up the sweep's date-window scans over live listings.
create index if not exists listings_active_available_from_idx
  on listings (available_from)
  where status = 'active';
