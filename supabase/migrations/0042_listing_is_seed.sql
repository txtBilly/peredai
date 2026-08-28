-- Mark mock/seed listings so they can always be sorted below real ones.
-- Real listings (created through the app) keep the default false; the seed
-- script sets this true on every listing it inserts. Browse/ticker order by
-- is_seed first, so any real listing outranks the whole mock set.
alter table listings add column if not exists is_seed boolean not null default false;

-- Speeds the "real first, then seed" ordering and any WHERE is_seed = false scans.
create index if not exists listings_is_seed_idx on listings (is_seed);
