-- Red-dot badge for the Saved page. When a saved listing returns to the market
-- we flag the saver's favourite row as "unseen"; the Saved nav shows a dot until
-- they open the Saved page, which clears it. Set by the service role in
-- dispatchListingFreed(); cleared by the owner (RLS "manage own favourites")
-- when the Saved page loads.
alter table favourites
  add column if not exists freed_unseen boolean not null default false;

-- Fast lookup for the header badge count (unseen rows per seeker).
create index if not exists favourites_unseen_idx
  on favourites (seeker_id)
  where freed_unseen;
