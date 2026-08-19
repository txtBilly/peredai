-- Unify existing free-text city values to the canonical name, so the filter
-- and dropdown don't show "New York" and "New York City" as separate places.
-- Going forward the listing form only allows the canonical set (see
-- SUPPORTED_CITIES / normalizeCity in lib/listings).
update listings
set city = 'New York City'
where city is not null
  and lower(replace(trim(city), '.', '')) in ('new york', 'new york city', 'nyc', 'ny', 'new york, ny');
