# Ten2Ten — Deploy Checklist

Running list of things that must be true (or configured) before/at production
deploy. Grouped by area. Check items off as they're done.

## Waitlist / "listing freed" notifications (trust-critical)

When a listing returns to the market (a conversation ends without a deal, or a
stale chat is auto-expired), everyone who saved it must be told **immediately**.
Delayed or missing alerts break the waitlist promise ("We'll email you the
moment it opens up"), so this is a launch blocker, not a nice-to-have.

Current state (as built):
- Seeker/lister-initiated closes call `POST /api/listings/[id]/notify-freed`
  from the client, which fans out via `dispatchListingFreed()` in `lib/notify.ts`.
- The stale-chat sweep route `POST /api/chats/expire-stale` also fans out to
  savers of listings it auto-freed in that run.
- Delivery is preference-gated and currently **stubbed** (no real email/SMS
  send) until provider keys are set. Push is a no-op.

- [ ] **Single, reliable sweep path.** The in-database `pg_cron` job calls
  `sweep_chat_deadlines()` directly in Postgres and does **not** run the
  notification fan-out (that lives in the TS route). Pick ONE:
  - Preferred: drive the sweep from an **external scheduler that hits the HTTP
    route** (Vercel Cron / GitHub Actions / cron → `POST /api/chats/expire-stale`),
    and **remove the in-DB `pg_cron` job** so there's exactly one path that both
    frees listings and notifies savers.
  - Alternative: keep `pg_cron` but have the SQL trigger the fan-out via
    **`pg_net`** (outbound HTTP to a notify endpoint / Supabase Edge Function).
    Needs a migration.
- [ ] **Email delivery on.** Set the Resend API key/env so `sendEmail()` in
  `lib/twilio.ts` actually sends instead of console-logging (stub mode).
- [ ] **`CRON_SECRET` set** and the external scheduler sends
  `Authorization: Bearer <CRON_SECRET>` to `/api/chats/expire-stale`.
- [ ] **Push notification.** `listing_freed` should also fire a push. Push is a
  no-op until real push infra exists (web-push/VAPID or FCM/APNs): device-token
  storage, service worker + subscription flow, and a `sendPush()` implementation
  wired into `notify.listingFreed`. (P1 infra — track separately.)
- [ ] **In-app red-dot badge on the Saved nav item.** When a saved listing
  reopens, show an unread dot on "Saved" in `SiteHeader` until the user visits
  the Saved page. Needs unread tracking (e.g. `favourites.freed_seen_at` or a
  lightweight per-user notifications table + a count query in the header, cleared
  on Saved-page view). Migration required.
- [ ] **De-dupe / idempotency.** Ensure a listing that flaps active↔negotiating
  doesn't email savers repeatedly. Consider a "last notified" stamp per
  (listing, freed event) so each reopening notifies at most once.

## Email confirmation / account activation

Browsing stays open to anyone, but **Connect and List must require a confirmed
email**. Not yet built as an in-app gate (decision: checklist-only for now).

- [ ] **Enable email confirmation in Supabase Auth** (Authentication → email
  confirmations ON) and configure SMTP / Resend so confirmation emails actually
  send. The signup flow already has a `confirm` state fallback for when this is
  on (`src/app/[locale]/signup/page.tsx`).
- [ ] **Gate Connect** on `user.email_confirmed_at` (server: `/api/connect` and
  the `open_connect_chat` path; client: `ListingDetailView` Connect CTA). Show a
  "confirm your email to connect" prompt + resend action instead of connecting.
- [ ] **Gate List/publish** on `user.email_confirmed_at` (`ListForm` publish +
  the listings insert path). Same prompt + resend.
- [ ] **Resend-confirmation action** (`supabase.auth.resend({ type: 'signup' })`).
- [ ] Decide redirect/deep-link back to the intended action after confirming.

## Lister status-change notifications

Listers should learn when their listing state changes: a seeker connected (chat
opened), the chat closed (success / didn't-work), or the listing was
discontinued.

Current state:
- Chat opened → lister is emailed today via `notify.bidAccepted` (`/api/connect`).
- In-app **red-dot badge on the List nav** is built (see `listings.lister_unseen`),
  lit on any listing status change and cleared when the lister opens My Listings.

- [ ] **Chat-closed email to lister** (success and didn't-work). Reuses the
  stubbed `notify` pipeline; add a `notify.*` method + fire it on the close paths.
- [ ] **Listing-discontinued email to lister** (esp. if admin/moderation-driven).
- [ ] **Push** for these lister events — same P1 push infra dependency as above.

## Notification prefs

- [ ] Confirm every user has a `notification_prefs` row. No trigger seeds one at
  signup today; the "Notify me if available" opt-in seeds a default row on click,
  but other flows assume a row exists. Consider a `handle_new_user`-style trigger
  (or default-on-read fallback in `dispatch()`).

## Env vars (fill in before deploy)

- [ ] `IDENTITY_PROVIDER=stripe`
- [ ] `STRIPE_IDENTITY_WEBHOOK_SECRET`
- [ ] Stripe API keys (live)
- [ ] Resend API key (email)
- [ ] Twilio keys (SMS) — if SMS enabled
- [ ] `CRON_SECRET`
- [ ] Supabase URL / anon / service-role keys
