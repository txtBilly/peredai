-- Audit log of inbound Tochka webhook deliveries.
--
-- The webhook endpoint records every POST it receives here — raw body, headers,
-- the qrcId we managed to extract, and what action we took. This lets us see the
-- exact payload Tochka delivers (via test_send, or a real payment) and confirm
-- the receiver behaves, before/without relying on doc guesses. Server-only.

create table if not exists public.tochka_webhook_log (
  id            uuid primary key default gen_random_uuid(),
  received_at   timestamptz not null default now(),
  content_type  text,
  headers       jsonb,
  body          text,
  parsed_qrc_id text,
  action        text
);

alter table public.tochka_webhook_log enable row level security;

create index if not exists tochka_webhook_log_received_idx
  on public.tochka_webhook_log (received_at desc);
