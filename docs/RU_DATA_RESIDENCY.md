# Peredai — Data Residency (152-ФЗ / 242-ФЗ) plan

**Decision:** run the **full Supabase stack self-hosted on a Russian cloud**
(Yandex Cloud, launch target). This keeps every client library and env var the
same as the original codebase — `@supabase/ssr`, `@supabase/supabase-js`, RLS,
and the `SECURITY DEFINER` functions all work unchanged — so residency is an
**infrastructure/deployment** task, not an application rewrite.

> ⚠️ **Legal review is required before any real Russian citizen's personal data
> is stored.** This document is an engineering plan, not legal advice. Have
> counsel confirm the hosting region, the data-processing notice, Roskomnadzor
> data-operator registration, and cross-border transfer posture.

---

## 1. Why self-host Supabase (vs. migrating off it)

The app leans hard on Supabase-specific surfaces:

- `@supabase/ssr` cookie-based auth in `src/lib/supabase/{client,server}.ts`
- Row-Level Security policies (`supabase/rls-policies.sql`)
- `SECURITY DEFINER` Postgres functions — e.g. `open_connect_chat`,
  `handle_new_user`, ban/close/duplicate-review triggers
- Supabase Storage (`listing-photos` bucket) + Realtime (chat)

Self-hosting the whole stack (Postgres + GoTrue + PostgREST + Storage +
Realtime + Studio) preserves all of it. Migrating to managed Postgres + a
different auth system would mean rewriting auth, RLS enforcement, storage, and
realtime — far more risk. **Keep Supabase; move where it runs.**

## 2. What "the Russian regime" requires (engineering summary)

152-ФЗ + 242-ФЗ: the **primary databases where Russian citizens' personal data
is collected, recorded, systematized, accumulated, and stored must be physically
located in Russia.** Practical implications for Peredai:

- Postgres (the system of record) runs in a Russian region.
- Object storage for listing photos + any PII exports runs in Russia.
- Auth (GoTrue) user table runs in Russia (it's part of the same Postgres).
- Email/SMS processors may be abroad, but minimize PII in their payloads.
- Register as a data operator with Roskomnadzor (legal task).

## 3. Target topology (Yandex Cloud)

```
┌──────────────────────── Yandex Cloud (ru-central1) ─────────────────────────┐
│                                                                             │
│  Compute Instance / k8s              Managed Service for PostgreSQL         │
│  (self-hosted Supabase via           (OR Postgres inside the compute VM)    │
│   docker-compose or Helm)            - system of record, in-region          │
│    ├ kong (api gateway)                                                     │
│    ├ gotrue (auth)  ───────────────▶ Postgres (auth schema)                │
│    ├ postgrest (rest)                                                       │
│    ├ realtime                                                               │
│    ├ storage-api  ─────────────────▶ Yandex Object Storage (S3-compatible) │
│    └ studio (admin, IP-restricted)                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
        ▲                                        ▲
        │ NEXT_PUBLIC_SUPABASE_URL               │ SUPABASE_SERVICE_ROLE_KEY
        │ NEXT_PUBLIC_SUPABASE_ANON_KEY          │ (server-only)
   Vercel/hosting (app)  ── or host the Next.js app in-region too for latency ──
```

Two valid database choices:

1. **All-in-one self-host** — Postgres runs as a container in the same
   compose/Helm deployment as the rest of Supabase. Simplest; you own backups.
2. **Managed PG + self-hosted services** — point GoTrue/PostgREST/Storage/
   Realtime at **Yandex Managed Service for PostgreSQL**. You get managed
   backups, HA, and PITR; the Supabase services are stateless containers.
   **Recommended for production** (less ops burden on the DB, the riskiest part).

Object storage: **Yandex Object Storage** is S3-compatible; point `storage-api`
at it (in-region bucket) so listing photos never leave Russia.

## 4. Standing up the stack

1. Provision the Yandex Cloud project, a VPC, and (option 2) a Managed
   PostgreSQL cluster in `ru-central1`.
2. Deploy self-hosted Supabase (official `supabase/docker` compose, or a Helm
   chart) onto a compute instance or Managed Kubernetes. Set strong `JWT_SECRET`,
   `ANON_KEY`, `SERVICE_ROLE_KEY`, `POSTGRES_PASSWORD`, SMTP (Resend), and the
   S3 storage backend (Yandex Object Storage credentials + endpoint).
3. Run the schema against the in-region Postgres, in order:
   - `supabase/schema.sql`
   - every file in `supabase/migrations/` in numeric order **including the new
     RU migrations `0036_ru_drop_zip.sql` and `0037_ru_remove_credit_score.sql`.**
4. Configure GoTrue **Auth → URL Configuration**: Site URL + Redirect URLs = the
   Peredai domain, plus the OAuth callback `…/api/identity/callback` (Yandex ID).
5. Lock down: Studio behind IP allow-list/VPN, TLS everywhere, disable public
   Postgres exposure, restrict the storage bucket, rotate keys.

## 5. App env mapping (no code change)

`.env.example` already points at the self-hosted stack:

```
NEXT_PUBLIC_SUPABASE_URL=https://supabase.your-ru-host.ru
NEXT_PUBLIC_SUPABASE_ANON_KEY=…            # from the self-host JWT keys
SUPABASE_SERVICE_ROLE_KEY=…                # server-only
```

Because the client libraries are unchanged, switching from cloud Supabase to the
self-hosted RU stack is purely these three values (+ Storage endpoint config in
the self-host).

## 6. Interim (internal/preview) vs. launch

- **Preview / internal build:** may run on cloud Supabase with **no real
  Russian users' PII** (synthetic/test data only). Fine for demoing the fork.
- **Public launch:** must be on the in-region self-hosted stack, with legal
  sign-off, before onboarding real users.

## 7. Open items (owners)

- [ ] Legal: Roskomnadzor data-operator registration + processing notice.
- [ ] Legal: cross-border transfer stance for email (Resend) / any non-RU vendor.
- [ ] Ops: choose all-in-one vs. Managed PG; provision `ru-central1`.
- [ ] Ops: backups + PITR + restore drill.
- [ ] Swap SMS (Twilio) for a Russian aggregator (SMSC.ru / SMS Aero).
- [ ] Deliverability warm-up for Mail.ru / Yandex inboxes (Resend domain).
