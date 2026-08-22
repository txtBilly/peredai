import twilio from 'twilio';
import { Resend } from 'resend';

// ---- SMS (Twilio) ----------------------------------------------------------
const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

export async function sendSms(to: string, body: string): Promise<void> {
  if (!twilioClient) {
    console.warn('[sms] Twilio not configured — would send:', { to, body });
    return;
  }
  await twilioClient.messages.create({
    to,
    from: process.env.TWILIO_PHONE_NUMBER!,
    body,
  });
}

// ---- Email (Resend) --------------------------------------------------------
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — email NOT sent:', {
      to: params.to,
      subject: params.subject,
    });
    return;
  }
  const from = process.env.RESEND_FROM_EMAIL ?? 'hello@ten2ten.app';
  // The Resend SDK returns { data, error } and does NOT throw on API errors
  // (unverified sender, restricted recipient, etc.), so we must inspect the
  // result explicitly — otherwise failed sends vanish silently.
  const { data, error } = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
  if (error) {
    console.error('[email] Resend send failed', { from, to: params.to, error });
    throw new Error(`resend_send_failed: ${error.message ?? 'unknown'}`);
  }
  console.log('[email] sent', { id: data?.id, to: params.to, subject: params.subject });
}

// ---- Notification dispatch helpers -----------------------------------------
// Thin wrappers around the events the product cares about. These are called
// from server actions / webhooks. Channel selection (sms/email/push) per user
// is read from notification_prefs by the caller.

export const notifications = {
  bidAccepted(to: { phone?: string; email?: string }, listingArea: string) {
    const msg = `Ten2Ten: your contact was accepted for ${listingArea}. Open the app to message and arrange a viewing. You have 24h to start.`;
    if (to.phone) return sendSms(to.phone, msg);
  },
  listingFreed(to: { phone?: string; email?: string }, listingArea: string) {
    const msg = `Ten2Ten: a place you favourited in ${listingArea} just opened up. First to connect gets it.`;
    if (to.phone) return sendSms(to.phone, msg);
  },
  expiryWarning(to: { phone?: string }, hoursLeft: number) {
    if (to.phone)
      return sendSms(
        to.phone,
        `Ten2Ten: your chat expires in ${hoursLeft}h. Send a message to keep it active.`
      );
  },
};
