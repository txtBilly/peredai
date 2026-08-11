-- Extend the verified-name lock to the Stripe Identity path.
--
-- 0014 only reverted full_name changes once bg_check_completed_at was set, so a
-- member verified via the *ID* path (identity_verified_at, no background check)
-- could still edit their legal name in the profile form. Lock on either signal.
--
-- Each verification write advances its own timestamp in the same UPDATE, so a
-- legitimate (re)verification is exempt: for the path doing the verifying, the
-- new timestamp differs from the old (or the old was null on first verify).

create or replace function lock_verified_full_name()
returns trigger
language plpgsql
as $$
begin
  if new.full_name is distinct from old.full_name
     and (
       -- Background-check path already verified and not being re-advanced now.
       (old.bg_check_completed_at is not null
        and new.bg_check_completed_at is not distinct from old.bg_check_completed_at)
       or
       -- Identity (ID) path already verified and not being re-advanced now.
       (old.identity_verified_at is not null
        and new.identity_verified_at is not distinct from old.identity_verified_at)
     )
  then
    new.full_name := old.full_name;
  end if;
  return new;
end;
$$;

-- Trigger definition is unchanged from 0014; the function body above is the fix.
drop trigger if exists trg_lock_verified_full_name on profiles;
create trigger trg_lock_verified_full_name
  before update on profiles
  for each row
  execute function lock_verified_full_name();
