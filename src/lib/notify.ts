import { createAdminClient } from './supabase/server';
import { sendSms, sendEmail } from './twilio';

// Notification dispatch (Session 5). For each product event we read the user's
// per-event channel prefs (notification_prefs), resolve their phone/email, and
// fan out to the chosen channels. sendSms/sendEmail no-op with a console warning
// when Twilio/Resend aren't configured, so this is safe to call without keys
// (stub mode) — flip to real delivery by adding the env vars. Push is a no-op
// until real push infra (P1). Transactional/safety messages should bypass this
// and always send; these four are preference-gated product notifications.

export type NotifyEvent = 'bid_accepted' | 'chat_message' | 'listing_freed' | 'expiry_warn';

type EmailContent = { subject: string; html: string };

// Base URL for links in emails. NEXT_PUBLIC_APP_URL is set in the Vercel env;
// fall back to the production domain so links are never broken.
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://ten2ten.ru').replace(/\/+$/, '');

// Build a simple, email-client-safe HTML body: the message plus a CTA button
// and a plain fallback link to the site.
function emailHtml(message: string, path: string, cta = 'Открыть Ten2Ten'): string {
  const url = `${APP_URL}${path.startsWith('/') ? path : `/${path}`}`;
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#14140f;">
    <p style="margin:0 0 16px;">${message}</p>
    <p style="margin:0 0 20px;">
      <a href="${url}" style="display:inline-block;background:#1B4DE4;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">${cta}</a>
    </p>
    <p style="margin:0;font-size:12px;color:#6b7280;">Или перейдите: <a href="${url}" style="color:#1B4DE4;">${url}</a></p>
  </div>`;
}

// SMS/push defaults per event, used when a user has no prefs row yet (none is
// auto-created at signup). Email is NOT gated by this — it always sends (see
// dispatch) — but it's listed here too so the intent is visible at a glance.
const DEFAULT_PREFS: Record<NotifyEvent, string[]> = {
  bid_accepted: ['sms', 'email'],
  chat_message: ['email'],
  listing_freed: ['push', 'email'],
  expiry_warn: ['sms', 'push', 'email'],
};

async function dispatch(userId: string, event: NotifyEvent, sms: string, email?: EmailContent): Promise<void> {
  const admin = createAdminClient();

  const { data: prefs } = await admin
    .from('notification_prefs')
    .select(event)
    .eq('user_id', userId)
    .maybeSingle();
  // Prefs gate only SMS/push. Email is intentionally NOT read from prefs — it's
  // an always-on channel on Ten2Ten that members can't opt out of.
  const channels = prefs
    ? (((prefs as Record<string, unknown>)[event] as string[] | undefined) ?? [])
    : DEFAULT_PREFS[event];

  const { data: profile } = await admin
    .from('profiles')
    .select('phone, email')
    .eq('id', userId)
    .maybeSingle();

  const jobs: Promise<unknown>[] = [];
  // Email always sends (not opt-out-able) whenever the event carries email copy.
  if (profile?.email && email) {
    jobs.push(sendEmail({ to: profile.email, subject: email.subject, html: email.html }));
  }
  // SMS stays preference-gated. 'push' → no-op until real push infra (P1).
  if (channels.includes('sms') && profile?.phone) jobs.push(sendSms(profile.phone, sms));

  await Promise.allSettled(jobs);
}

// Transactional send — always delivered (not preference-gated), for outcomes
// the member needs to know about regardless of their marketing prefs.
async function sendDirect(userId: string, sms: string, email: EmailContent): Promise<void> {
  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('phone, email').eq('id', userId).maybeSingle();
  const jobs: Promise<unknown>[] = [];
  if (profile?.phone) jobs.push(sendSms(profile.phone, sms));
  if (profile?.email) jobs.push(sendEmail({ to: profile.email, subject: email.subject, html: email.html }));
  await Promise.allSettled(jobs);
}

// Fan-out helper: email everyone who saved a listing that just returned to the
// market. Shared by the seeker-triggered notify-freed route and the stale-chat
// sweep. No-ops unless the listing is currently active. Returns the recipient
// count. Pass excludeIds to skip people who already know (e.g. whoever closed).
export async function dispatchListingFreed(listingId: string, excludeIds: string[] = []): Promise<number> {
  const admin = createAdminClient();
  const { data: listing } = await admin
    .from('listings')
    .select('lister_id, neighborhood, status')
    .eq('id', listingId)
    .maybeSingle();
  if (!listing || listing.status !== 'active') return 0;

  const { data: favourites } = await admin.from('favourites').select('seeker_id').eq('listing_id', listingId);
  const area = listing.neighborhood ?? 'вашем районе';
  const seekerIds = Array.from(
    new Set(
      (favourites ?? [])
        .map((f) => f.seeker_id)
        .filter((sid): sid is string => !!sid && sid !== listing.lister_id && !excludeIds.includes(sid))
    )
  );

  // Light up the Saved-nav red dot for these savers (cleared when they open the
  // Saved page). Service-role update — bypasses RLS.
  if (seekerIds.length > 0) {
    await admin
      .from('favourites')
      .update({ freed_unseen: true })
      .eq('listing_id', listingId)
      .in('seeker_id', seekerIds);
  }

  await Promise.allSettled(seekerIds.map((sid) => notify.listingFreed(sid, area, listingId)));
  return seekerIds.length;
}

export const notify = {
  // A verified seeker connected to a listing → tell the lister.
  bidAccepted(listerId: string, area: string, chatId?: string) {
    const msg = `Проверенный участник отправил запрос по вашему объявлению (${area}). У него есть 24 часа, чтобы начать разговор.`;
    return dispatch(listerId, 'bid_accepted', `Ten2Ten: ${msg}`, {
      subject: 'Новый запрос по вашему объявлению',
      html: emailHtml(msg, chatId ? `/ru/chats/${chatId}` : '/ru/browse', 'Открыть чат'),
    });
  },
  // New chat message → tell the other party.
  chatMessage(recipientId: string, fromName: string, chatId?: string) {
    const msg = `Новое сообщение от ${fromName}.`;
    return dispatch(recipientId, 'chat_message', `Ten2Ten: ${msg} Откройте приложение, чтобы ответить.`, {
      subject: `Новое сообщение от ${fromName}`,
      html: emailHtml(msg, chatId ? `/ru/chats/${chatId}` : '/ru', 'Открыть чат'),
    });
  },
  // A favourited listing returned to the market → tell the favouriter.
  listingFreed(userId: string, area: string, listingId?: string) {
    const msg = `Квартира из избранного снова доступна (${area}). Кто первым отправит запрос — тому и достанется.`;
    return dispatch(userId, 'listing_freed', `Ten2Ten: ${msg}`, {
      subject: 'Избранная квартира снова доступна',
      html: emailHtml(msg, listingId ? `/ru/browse/${listingId}` : '/ru/browse', 'Посмотреть объявление'),
    });
  },
  // Chat approaching a deadline → nudge the party who must act.
  expiryWarn(userId: string, hoursLeft: number, chatId?: string) {
    const msg = `Ваш чат истекает через ${hoursLeft} ч. Отправьте сообщение, чтобы сохранить его активным.`;
    return dispatch(userId, 'expiry_warn', `Ten2Ten: ${msg}`, {
      subject: 'Ваш чат скоро истечёт',
      html: emailHtml(msg, chatId ? `/ru/chats/${chatId}` : '/ru', 'Открыть чат'),
    });
  },
  // A report the member filed was reviewed (transactional — always sent).
  reportReviewed(reporterId: string, confirmed: boolean) {
    const outcome = confirmed
      ? 'Мы рассмотрели вашу жалобу и приняли меры. Спасибо, что помогаете сохранять безопасность Ten2Ten.'
      : 'Мы рассмотрели вашу жалобу и в этот раз не нашли нарушения. Спасибо, что сообщили.';
    return sendDirect(reporterId, `Ten2Ten: ${outcome}`, {
      subject: 'Ваша жалоба рассмотрена',
      html: `<p>${outcome}</p>`,
    });
  },
};
