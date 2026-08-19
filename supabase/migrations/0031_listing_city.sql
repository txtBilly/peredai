-- City for the Browse city filter. Listers set it; when they don't, it's filled
-- from the ZIP (see cityFromZip in lib/listings). Backfill existing rows from
-- their ZIP so the default "New York City" filter shows them immediately.
alter table listings
  add column if not exists city text;

update listings
set city = case
  -- NYC ZIP prefixes: Manhattan/Bronx/Staten Island (100–104) and
  -- Brooklyn/Queens (110–114, 116).
  when left(zip, 3) in ('100', '101', '102', '103', '104') then 'New York City'
  when left(zip, 3) in ('110', '111', '112', '113', '114', '116') then 'New York City'
  else city
end
where city is null and zip is not null;

create index if not exists listings_city_idx on listings (city);
