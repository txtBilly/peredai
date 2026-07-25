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

async function dispatch(userId: string, event: NotifyEvent, sms: string, email?: EmailContent): Promise<void> {
  const admin = createAdminClient();

  const { data: prefs } = await admin
    .from('notification_prefs')
    .select(event)
    .eq('user_id', userId)
    .maybeSingle();
  const channels = ((prefs as Record<string, unknown> | null)?.[event] as string[] | undefined) ?? [];
  if (channels.length === 0) return;

  const { data: profile } = await admin
    .from('profiles')
    .select('phone, email')
    .eq('id', userId)
    .maybeSingle();

  const jobs: Promise<unknown>[] = [];
  if (channels.includes('sms') && profile?.phone) jobs.push(sendSms(profile.phone, sms));
  if (channels.includes('email') && profile?.email && email) {
    jobs.push(sendEmail({ to: profile.email, subject: email.subject, html: email.html }));
  }
  // 'push' → intentionally no-op until real push infrastructure (P1).

  await Promise.allSettled(jobs);
}

export const notify = {
  // A verified seeker connected to a listing → tell the lister.
  bidAccepted(listerId: string, area: string) {
    const msg = `Ten2Ten: a verified seeker just connected to your listing in ${area}. Open the app to reply — they have 24h to start the conversation.`;
    return dispatch(listerId, 'bid_accepted', msg, {
      subject: 'Someone connected to your listing',
      html: `<p>${msg}</p>`,
    });
  },
  // New chat message → tell the other party.
  chatMessage(recipientId: string, fromName: string) {
    const msg = `Ten2Ten: new message from ${fromName}. Open the app to reply.`;
    return dispatch(recipientId, 'chat_message', msg, {
      subject: `New message from ${fromName}`,
      html: `<p>${msg}</p>`,
    });
  },
  // A favourited listing returned to the market → tell the favouriter.
  listingFreed(userId: string, area: string) {
    const msg = `Ten2Ten: a place you favourited in ${area} just opened up. First to connect gets it.`;
    return dispatch(userId, 'listing_freed', msg, {
      subject: 'A favourited listing reopened',
      html: `<p>${msg}</p>`,
    });
  },
  // Chat approaching a deadline → nudge the party who must act.
  expiryWarn(userId: string, hoursLeft: number) {
    const msg = `Ten2Ten: your chat expires in ${hoursLeft}h. Send a message to keep it active.`;
    return dispatch(userId, 'expiry_warn', msg, {
      subject: 'Your chat is expiring soon',
      html: `<p>${msg}</p>`,
    });
  },
};
