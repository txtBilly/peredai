# Peredai — Russia Market Spec (fork of Ten2Ten)

**Brand:** Peredai (Передай — "pass it on"). Peer-to-peer apartment lease handoff,
Russia, Russian language. This is a **separate fork** — apply everything here on
the new repo, never the original. Read `NEW_MARKET_PLAYBOOK.md` first for the fork
procedure and the general architecture; this doc is the Russia-specific delta.

Defaults chosen: name **Peredai**; identity via OAuth (**Yandex ID first**, then
Sber ID, T-ID); launch cities **Moscow + St. Petersburg** (structured to add more).

---

## 0. Two BIG items that are not copy tweaks (decide before building)

1. **Payments.** Stripe does not operate in Russia. The contact-credit purchase
   and any fees must move to a Russian processor — **YooKassa (ЮKassa)**,
   CloudPayments, or Sber acquiring. This replaces `STRIPE_SECRET_KEY` +
   `/api/stripe/*` + the checkout/webhook flow. Scope it as its own workstream.
2. **Data residency (152-ФЗ / 242-ФЗ).** Russian law requires personal data of
   Russian citizens to be stored on servers **located in Russia**. Supabase is not
   Russian-hosted. For a compliant launch, host Postgres in Russia (Yandex Cloud /
   VK Cloud / SberCloud managed Postgres) or self-host; you can keep the Supabase
   client libraries against a Russia-hosted Postgres + GoTrue, or migrate auth.
   **Get legal review.** For an internal/preview build you can start on Supabase,
   but do not onboard real Russian users' PII until residency is resolved.

Everything below is the product/code delta; the two items above are prerequisites
for a *public* Russian launch.

---

## 1. Geography — remove postal codes, city becomes a first-class field

Russia has postal indices but the product should **not** derive location from them.

- `src/lib/listings.ts`:
  - Delete `ZIP_CITY_RANGES` and `cityFromZip()`.
  - `SUPPORTED_CITIES = ['Москва', 'Санкт-Петербург']` (add: Новосибирск,
    Екатеринбург, Казань, Нижний Новгород, Краснодар, Сочи later).
  - `DEFAULT_CITY = 'Москва'`.
  - Keep `normalizeCity()` for aliases (e.g. "Спб"/"СПб" → "Санкт-Петербург",
    "Питер" → "Санкт-Петербург", "Msk" → "Москва").
- `src/app/[locale]/list/ListForm.tsx`:
  - Remove the ZIP input and the "city derived from ZIP" hint.
  - Add a **required City `<select>`** populated from `SUPPORTED_CITIES`.
  - Optional free-text **District / Metro (Район / Метро)** field — repurpose the
    existing `cross_streets` column (rename in copy only) for "nearest metro /
    district," which is how Russians locate flats.
- `src/app/[locale]/browse/BrowseView.tsx`:
  - City filter `<select>` already exists — keep; it now drives everything (no ZIP).
  - Search placeholder → "Район, метро, улица" (district, metro, street).
  - Listing rows/cards: drop the ZIP shown next to the city.
- **DB migration** (new, e.g. `0036_ru_drop_zip.sql`): make `listings.zip`
  nullable / stop requiring it (the `city` column already exists from `0031`).
  Keep the column for now to avoid a destructive change; just stop writing/reading it.

## 2. Identity — OAuth (Yandex ID / Sber ID / T-ID) instead of Stripe Identity

The codebase already abstracts this behind `IdentityProvider` (`src/lib/identity/
index.ts`) with `stripe.ts` and `mock.ts`. Add OAuth providers alongside.

- The flow differs from Stripe: OAuth **authorization-code** redirect, not hosted
  document capture.
  1. `startVerification()` → build the provider authorize URL (client_id, scope,
     redirect_uri, state) and return it as `redirectUrl`.
  2. New route `src/app/api/identity/callback/route.ts` handles the redirect back:
     exchange `code` → access token → fetch userinfo → map to
     `VerificationResult` → `applyVerificationResult()`. (Analogous to the Stripe
     webhook, but it's a user-facing redirect.)
- Add `src/lib/identity/yandex.ts` first (Yandex OAuth 2.0 + `login.yandex.ru/info`
  for name; `is_avatar_empty`, `birthday` if `login:birthday` scope granted for the
  18+ check). Then `sber.ts` (Sber ID / OpenID Connect) and `tid.ts` (Tinkoff ID).
- `IDENTITY_PROVIDER = yandex | sber | tid | mock`. Env per provider:
  `YANDEX_CLIENT_ID` / `YANDEX_CLIENT_SECRET` (and Sber/T-ID equivalents),
  `IDENTITY_REDIRECT_URL`.
- Remove Stripe-Identity-only pieces: `STRIPE_IDENTITY_WEBHOOK_SECRET`, the
  identity webhook route, and Stripe document-verification copy. Keep `mock.ts`
  for previews.
- Age/18+ check: keep the gate but source age from the OAuth birthday claim; if a
  provider doesn't return it, fall back to their KYC-verified adult flag or require
  an explicit DOB step.

## 3. Remove credit score entirely

No credit score in Russia — strip it from data, gating, and copy.

- **Listing form** (`ListForm.tsx`): remove the `min_credit_score` field.
- **Connect gating** (DB function `open_connect_chat` + `src/app/api/connect/
  route.ts`): remove the `below_min_score` check and drop it from `KNOWN_ERRORS`.
  New migration to `create or replace` the function without the score comparison.
- **Chat disclosure** (`src/app/[locale]/chats/[id]/ChatView.tsx`): remove the
  seeker's credit-band line shown to the lister (`disclosed_credit_score` /
  `creditBand()`), and delete the two safety bullets that mention credit
  ("We've shared a verified credit-score range…" / "Your credit score has been
  shared with the lister already.").
- **Verify/background screen** (`src/app/[locale]/background/verify/VerifyView.tsx`):
  remove the "credit score N" line; keep the "verified / N contact credits added"
  outcome. Reconsider whether a separate "background check" step exists at all in
  RU — the OAuth ID likely serves as verification, so the credit-based background
  check can be removed and credits granted on successful ID verification.
- **DB**: `listings.min_credit_score` and `chats.disclosed_credit_score` become
  unused — stop populating/reading; optional later migration to drop.
- **i18n**: delete all credit-score strings.

## 4. Currency, dates, language

- **Currency**: replace `'$'` and `toLocaleString('en-US')` (~17 spots) with RUB.
  Russian format is `50 000 ₽` (space thousands sep, symbol after, `/мес` for
  monthly). Consider a small `formatRub()` helper. Gratuity/credit amounts too.
- **Dates**: `toLocaleDateString('ru-RU', …)`.
- **Language**: add `src/i18n/ru.json` (translate every key). In
  `src/i18n/config.ts` make `ru` a supported locale; recommend locales `['ru']`
  with `ru` default (drop `es`; keep `en` only if you want a fallback). Update the
  `[locale]` routing and the locale toggle in `SiteHeader` (or remove the toggle
  if single-language).
- Translate the market-specific copy that isn't a 1:1 string: safety bullets,
  Browse-locked message, welcome/marketing, report reasons (both lister & seeker
  lists), verify flow, emails.

## 5. Branding → Peredai

- **Name**: replace "Ten2Ten" across ~40 files (mostly via `i18n` brand keys;
  hardcoded spots: `src/app/layout.tsx` metadata, `public/manifest.json`, email
  `from`, SMS sender). Brand string: **Peredai** (wordmark can use Cyrillic
  «Передай»).
- **Logo/favicon**: new `public/*-logo.svg`, and regenerate `src/app/icon.png`,
  `apple-icon.png`, `favicon.ico`, `public/apple-touch-icon.png` (see playbook §5
  for the cairosvg/Pillow method; composite gradient cutouts, no masks).
- **Colors**: keep the cobalt→violet system or restyle in `tailwind.config.ts` +
  `globals.css`.
- **Reviews/testimonials** (`welcome/page.tsx`): rewrite with Russian names +
  Moscow/SPb districts (e.g. Хамовники, Василеостровский).

## 6. Reused as-is (the rules that stay the same)

One open chat at a time; verified-only to connect/list; gratuity model; email
always-on + 30-min new-message throttle; report flow (role-specific lists);
account-delete blocked while a chat is open; local-scope sign-out; passcode gate.
No changes needed beyond translation.

## 7. Infra for the fork (see playbook §2, RU specifics)

- Domain: `peredai.app` (or `.ru` — `.ru` needs a registrar that supports it).
- Email: verify the domain in Resend; `RESEND_FROM_EMAIL = hello@peredai.app`.
  (Deliverability to Russian inboxes — Mail.ru/Yandex — may need extra warming.)
- Env deltas from the playbook table: drop Stripe-Identity vars; add OAuth provider
  creds; add the Russian payment-provider creds (YooKassa etc.); set
  `NEXT_PUBLIC_APP_URL` to the new domain.

## 8. Build order (suggested for the new chat)

1. Fork repo + new Supabase + Vercel + domain (playbook §2).
2. Language + branding: `ru.json`, name/logo/favicon, currency/date helpers.
3. Geography: strip ZIP, city selector, migration.
4. Remove credit score (form, DB function, chat, verify, i18n).
5. Identity: `mock` first to get end-to-end green, then Yandex OAuth.
6. Payments: replace Stripe with YooKassa (separate workstream).
7. Data-residency plan before real users (legal + hosting).
8. Verify against the playbook §6 checklist (adapted: no credit score, OAuth ID).
