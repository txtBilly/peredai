-- Number of bathrooms on a listing. numeric(3,1) so half-baths (1.5, 2.5) work.
alter table listings
  add column if not exists bathrooms numeric(3,1);
