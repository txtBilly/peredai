# Ten2Ten — New-Market Fork Playbook

This document captures the architecture, the hard-won decisions, and a concrete
checklist for standing up a **separate, isolated copy** of Ten2Ten for a new
market (different city/country/language) **without touching the original**.

Approach chosen: **Separate fork** — new GitHub repo + new Supabase project + new
Vercel project + new domain. The two deployments share no infrastructure, so the
original is never at risk. The tradeoff is that bug fixes must be ported between
repos manually (see "Keeping forks in sync").

---

## 1. Stack & architecture (orientation)

- **Next.js 14.2.x, App Router.** Pages live in `src/app/[locale]/…`. The common
  pattern is a **server** `page.tsx` that fetches/guards, wrapping a **client**
  `*View.tsx` for interactivity. `SiteHeader` is an async server component and
  must NOT be rendered inside a client component.
- **Supabase** — Postgres + Auth + RLS + `SECURITY DEFINER` triggers/functions.
  Schema is `supabase/schema.sql`; incremental changes are `supabase/migrations/
  00xx_*.sql` (currently through `0035`). **Migrations are applied by hand in the
  Supabase SQL Editor** — pushing the file does not run it.
- **i18n** — all user copy lives in `src/i18n/en.json` and `src/i18n/es.json`,
  read via `getDictionary(locale)`. Locale is the first route segment (`/en`, `/es`).
- **Deploy** — Vercel builds from GitHub `main`. `NEXT_PUBLIC_*` vars are baked at
  build time (a change requires a redeploy). Server-only vars are read at runtime.
- **Providers are swappable via env**: identity (`IDENTITY_PROVIDER=mock|stripe`),
  background check, SMS (Twilio), email (Resend). Missing keys make the relevant
  sender no-op with a console warning, so the app runs without them.

Key third-party surfaces: **Supabase** (DB/auth), **Resend** (email — both the
app's API sends AND Supabase auth SMTP), **Stripe** (Identity + payments),
**Twilio** (SMS, optional).

---

## 2. Fork procedure (infrastructure)

Do these once per new market. Nothing here touches the original project.

1. **GitHub** — create a new repo and push a copy of this codebase to it
   (`git clone` the original, set a new `origin`, push). Do not fork-with-upstream
   unless you want to pull changes later.
2. **Supabase** — create a **new project**. Then, in its SQL Editor, run:
   - `supabase/schema.sql` (full base schema), then
   - every file in `supabase/migrations/` **in numeric order** (`0004 … 0035`).
   - Configure **Auth → URL Configuration**: Site URL + Redirect URLs = the new
     domain. Configure **Auth → SMTP** with Resend (host `smtp.resend.com`, port
     `465`, user `resend`, password = Resend API key) so auth emails send.
3. **Resend** — verify the **new domain** (DKIM `resend._domainkey` TXT, MX `send`
   → `feedback-smtp.us-east-1.amazonses.com`, SPF TXT on `send`). Create an API
   key. This same key is used two ways: Supabase SMTP password AND the app's
   `RESEND_API_KEY` env var (see §4 — these are separate configs!).
4. **Stripe** — new account (or reuse with new keys). For the preview you can run
   `IDENTITY_PROVIDER=mock` and skip real Stripe Identity; for public launch,
   activate Identity, set live keys, and register the webhook.
5. **Vercel** — new project importing the new GitHub repo. Add all env vars (§4),
   add the custom domain(s), point DNS (A `@` → Vercel `216.198.79.1`, CNAME
   `www`). Redeploy.

---

## 3. Localization checklist — everything market-specific

Work top to bottom. None of this affects the original repo once you're on the fork.

### 3.1 Copy & language (`src/i18n/`)
- `src/i18n/en.json`, `src/i18n/es.json` — **all** UI text: nav, hero/marketing,
  safety bullets (lister + seeker variants), the Browse-locked message, verify/
  background copy, report reasons, emails-adjacent strings, legal blurbs.
- If the new market needs a different language, add a new dictionary + locale code
  and update `src/i18n/config.ts` (`isLocale`, `getDictionary`, locale list).

### 3.2 Geography (`src/lib/listings.ts`)
- `SUPPORTED_CITIES` — the city list (currently NYC, Chicago, LA, San Diego,
  Miami, Fort Lauderdale, Seattle, Boston + New Jersey).
- `ZIP_CITY_RANGES` — numeric postal-code → city ranges. Replace with the new
  market's postal system. **If the new market isn't US ZIP-based**, `cityFromZip`
  and the ZIP field/validation need rethinking (postcode format, `min={todayStr}`
  is unrelated; the ZIP `min/max` numeric ranges are US-specific).
- `DEFAULT_CITY` — the default selected city.
- `normalizeCity()` aliases (e.g. "NYC" → "New York City").

### 3.3 Currency, dates, formatting (~17 spots)
- Search for `toLocaleString('en-US')`, `'$'`, and date `toLocaleDateString(...)`
  across `src`. Rent, gratuity, credit amounts, and dates are hardcoded to USD /
  `en-US`. Swap symbol/locale for the new market (e.g. `£`/`en-GB`, `€`/`de-DE`).

### 3.4 Branding
- **Name "Ten2Ten"** appears in ~40 files (see list from `grep -rIl "Ten2Ten"`).
  Most are in copy that also lives in i18n; a few are hardcoded (layout metadata
  `src/app/layout.tsx`, `public/manifest.json`, email `from`, SMS sender text).
- **Logo**: `public/ten2ten-logo.svg`, `public/ten2ten-mark.svg`.
- **Favicons**: `src/app/icon.png`, `src/app/apple-icon.png`, `src/app/favicon.ico`,
  `public/apple-touch-icon.png` (regenerate from an SVG; see §5 gotchas).
- **Brand colors**: `tailwind.config.ts` (`cobalt #1B4DE4`, `cobalt2 #5B2BFF`,
  `gradient-cobalt`) and `src/app/globals.css` (`.text-gradient-cobalt`,
  `.neo-page`). The favicon gradient is `#1B4DE4 → #8A0FFF`.
- **Testimonials/reviews** on the welcome page (`src/app/[locale]/welcome/page.tsx`)
  are NYC-neighborhood specific — rewrite for the new market.

### 3.5 Legal & policy
- `src/app/[locale]/terms/page.tsx`, `privacy/page.tsx`, `safety/page.tsx` —
  jurisdiction-specific; have them reviewed for the new market.

### 3.6 Pricing / fees (env-driven)
- `CONTACT_BUNDLE_PRICE_CENTS`, `BG_CHECK_FEE_CENTS` — set per market/currency.

---

## 4. Environment variables (per deployment)

Set all of these in the **new** Vercel project (Production + Preview). `NEXT_PUBLIC_*`
are build-time; the rest are runtime.

| Var | Purpose | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Base URL for links/emails | New domain, e.g. `https://<market>.app` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client | From new Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Server admin client | Secret |
| `RESEND_API_KEY` | **App** notification emails | **Separate from Supabase SMTP** — easy to forget; without it, all notification emails silently no-op |
| `RESEND_FROM_EMAIL` | Email `from` | Defaults to `hello@ten2ten.app`; set to a verified sender on the new domain |
| `SITE_PASSCODE` | Soft gate for the preview | Middleware gate, not a security boundary |
| `IDENTITY_PROVIDER` | `mock` or `stripe` | `mock` auto-verifies for testing |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe | Live keys for launch |
| `STRIPE_WEBHOOK_SECRET` / `STRIPE_IDENTITY_WEBHOOK_SECRET` | Stripe webhooks | Per environment |
| `MODERATION_SECRET` / `CRON_SECRET` | Protected endpoints | Random secrets |
| `MOCK_CREDIT_SCORE` / `MOCK_KYC_RESULT` / `MOCK_BG_CHECK_RESULT` | Mock outcomes | Dev/preview only |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | SMS | Optional; no-ops if unset |
| `BACKGROUND_CHECK_PROVIDER` / `BG_CHECK_FEE_CENTS` / `CONTACT_BUNDLE_PRICE_CENTS` | BG check + pricing | Per market |

---

## 5. Session knowledge & gotchas (learned building the original)

- **Resend has TWO configs.** Supabase auth emails use Resend **SMTP** (configured
  in the Supabase dashboard). The app's own notifications use the **Resend API**
  via `RESEND_API_KEY` in **Vercel**. Setting only the first makes auth emails work
  but leaves all in-app notifications silently dead. `sendEmail` logs `[email] …`
  lines to help diagnose (Vercel → Deployments → Runtime Logs).
- **Email is a mandatory, always-on channel.** `notify.ts::dispatch` always sends
  email regardless of `notification_prefs`; prefs only gate SMS/push. The settings
  UI locks the email checkboxes accordingly.
- **New-message emails are throttled** to one per recipient per chat per 30 min
  (`chats.seeker_notified_at` / `lister_notified_at`, migration `0035`).
- **Notifications go to the *other* party.** You cannot test a notification from a
  single account — connecting/ messaging requires a second account (seeker with
  credits + lister). You can't connect to your own listing.
- **Migrations run by hand.** Pushing a `.sql` file does nothing until you paste it
  into the Supabase SQL Editor. "No rows returned" on a DDL migration is success.
- **Identity provider.** `IDENTITY_PROVIDER=mock` auto-verifies (great for preview).
  Stripe **test mode never emits `.verified`** (ends `requires_input`), so real
  verification needs live keys + Identity activated. Return URL is derived from the
  request origin, not a build-time constant.
- **Duplicate-account detection** (`trg_flag_duplicate_profile`) flags reused mock
  identities during testing; it's currently **disabled** (migration `0034`). Re-enable
  for public launch with real identities.
- **`.next` cache corruption** can cause phantom local build errors (e.g. a server
  component "needs next/headers") while Vercel builds fine. Fix: stop dev server,
  `rm -rf .next node_modules/.cache`, restart.
- **Sign-out uses `scope: 'local'`** so logging out on one device doesn't kill
  sessions everywhere.
- **Favicons** are generated from an SVG via `cairosvg` + `Pillow`. Masks don't
  render reliably in cairosvg — composite cutouts by filling shapes with the same
  `userSpaceOnUse` gradient as the background instead.
- **Git in the sandbox**: the mount blocks unlinking `.git/*.lock`; if a commit
  fails with a stuck lock, `rm -f .git/index.lock .git/HEAD.lock` from a real
  terminal, then commit/push there.

---

## 6. Post-fork verification checklist

After the fork is deployed to its own domain:

- [ ] `npx tsc --noEmit` is clean.
- [ ] Passcode gate works on the new domain.
- [ ] Sign up → confirmation email arrives (Supabase SMTP / Resend).
- [ ] Profile is created correctly (name/avatar, not email-as-name).
- [ ] Identity verify flow completes (mock or Stripe) and returns to the new domain.
- [ ] Browse shows seeded listings; city filter + ZIP→city work for the new market.
- [ ] Connect (2nd account, credits) opens a chat AND emails the lister (with the
      CTA deep link pointing at the new domain).
- [ ] New-message email arrives once, then is throttled for 30 min.
- [ ] Currency/date formatting reads correctly for the market.
- [ ] Favicon + logo + brand name are all the new brand.

---

## 7. Keeping forks in sync

Because this is a hard fork, improvements don't propagate automatically. Options:
- Cherry-pick specific fixes between repos (`git remote add original …`,
  `git fetch original`, `git cherry-pick <sha>`).
- For infrastructure/logic fixes (not copy), keep changes in shared, non-localized
  files so they cherry-pick cleanly. Copy/geography/branding will always conflict —
  keep those changes isolated to the files in §3.

If you later maintain 3+ markets, revisit the **config-driven single-codebase**
approach (extract §3 into a `market` config selected by env) to stop duplicating fixes.
