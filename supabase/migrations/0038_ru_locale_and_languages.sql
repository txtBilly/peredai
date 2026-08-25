-- 0038_ru_locale_and_languages.sql
-- Russia market (Peredai): the profiles.preferred_locale CHECK constraint from
-- schema.sql only allowed ('en','es'), so any signup with 'ru' failed the
-- handle_new_user trigger / client upsert → the generic "something went wrong"
-- error on account creation.
--
-- Widen it to the RU-market locales and default to 'ru'. Apply by hand in the
-- Supabase SQL editor. "No rows returned" is success.

-- Drop whatever the existing preferred_locale check is named (inline column
-- checks get an auto-generated name; this finds it regardless).
do $$
declare c text;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%preferred_locale%'
  loop
    execute format('alter table public.profiles drop constraint %I', c);
  end loop;
end $$;

alter table public.profiles
  alter column preferred_locale set default 'ru';

alter table public.profiles
  add constraint profiles_preferred_locale_check
  check (preferred_locale in ('ru','en'));
