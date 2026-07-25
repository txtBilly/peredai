-- Session 5 prep (idempotent supersede of 0008, which wasn't applied live).
-- Rename the report reason to match the UI, and add the report-refund audit
-- flag + the ratings-driven suppression flag.

do $$
begin
  if exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'report_reason' and e.enumlabel = 'incomplete'
  ) then
    alter type report_reason rename value 'incomplete' to 'something_else';
  end if;
end $$;

alter table reports   add column if not exists refund_issued boolean not null default false;
alter table profiles  add column if not exists is_suppressed boolean not null default false;
