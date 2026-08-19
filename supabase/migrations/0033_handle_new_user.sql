-- Create the profile (and a notification_prefs row) automatically when an auth
-- user is created, populated from the signup metadata. Previously the profile
-- was written client-side only when signup returned a session immediately
-- (email confirmation OFF). With confirmation ON there's no session yet, so the
-- name/phone/languages were lost and the account showed the email with a "?".
-- This trigger fixes both paths. Runs as SECURITY DEFINER so it can write to
-- profiles regardless of RLS, and never blocks signup on error.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  md jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  langs text[];
begin
  begin
    langs := coalesce(array(select jsonb_array_elements_text(md->'spoken_languages')), '{}');
  exception when others then
    langs := '{}';
  end;
  if array_length(langs, 1) is null then langs := '{en}'; end if;

  insert into public.profiles (
    id, email, full_name, display_first_name, phone,
    preferred_locale, spoken_languages, intent, consent_version, consented_at
  ) values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(md->>'full_name', ''), split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(nullif(md->>'display_first_name', ''), split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(nullif(md->>'phone', ''), ''),
    coalesce(nullif(md->>'preferred_locale', ''), 'en'),
    langs,
    nullif(md->>'intent', ''),
    nullif(md->>'consent_version', ''),
    nullif(md->>'consented_at', '')::timestamptz
  )
  on conflict (id) do nothing;

  insert into public.notification_prefs (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
exception when others then
  -- Never block auth signup on profile seeding.
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
