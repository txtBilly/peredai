import twilio from 'twilio';
import { Resend } from 'resend';
import nodemailer, { type Transporter } from 'nodemailer';

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

// ---- Email -----------------------------------------------------------------
// Email goes out through ONE of two providers, chosen at runtime:
//   • 'smtp'   — any SMTP relay. For the RU market this is a Russian ESP
//                (SMTP.bz, UniOne/UniSender, …) which — unlike Resend/SES —
//                has the Yandex/Mail.ru postmaster standing needed to land in
//                the inbox for ya.ru / vk.ru recipients. Provider-agnostic:
//                switching ESPs is just changing SMTP_* env, no code change.
//   • 'resend' — kept as a fallback for dev / non-RU use.
// Resolution order: EMAIL_PROVIDER env wins if set; otherwise auto-detect —
// SMTP creds present → smtp; else RESEND_API_KEY → resend; else stub (no-op
// with a console warning, so the app runs fine without any email keys).
type EmailProvider = 'smtp' | 'resend' | 'stub';

function resolveEmailProvider(): EmailProvider {
  const explicit = process.env.EMAIL_PROVIDER?.toLowerCase();
  if (explicit === 'smtp' || explicit === 'resend' || explicit === 'stub') return explicit;
  if (process.env.SMTP_HOST && process.env.SMTP_USER) return 'smtp';
  if (process.env.RESEND_API_KEY) return 'resend';
  return 'stub';
}

// The From address MUST sit on a domain verified with the active provider
// (SMTP.bz: ten2ten.ru / 10210.ru) or the send is rejected. Display name is
// the brand; the address is env-driven so the sending domain can change
// without a code edit. SMTP_FROM_EMAIL wins; RESEND_FROM_EMAIL is the legacy
// fallback name for the same thing.
function fromAddress(): string {
  const email = process.env.SMTP_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? 'noreply@ten2ten.ru';
  const name = process.env.EMAIL_FROM_NAME ?? 'Ten2Ten';
  return name ? `${name} <${email}>` : email;
}

// Lazily-built, memoised clients so we don't construct them at import time
// (env may not be loaded yet) or on every send.
let _resend: Resend | null = null;
function resendClient(): Resend | null {
  if (_resend) return _resend;
  if (!process.env.RESEND_API_KEY) return null;
  _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

let _smtp: Transporter | null = null;
function smtpTransport(): Transporter | null {
  if (_smtp) return _smtp;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  // Implicit-TLS ports are 465/9465; STARTTLS ports are 587/2525/9587.
  // SMTP_SECURE ('true'/'false') overrides the port-based guess if needed.
  const secure =
    process.env.SMTP_SECURE != null
      ? process.env.SMTP_SECURE === 'true'
      : port === 465 || port === 9465;
  _smtp = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    // Fail fast so misconfig/blocked-port errors surface quickly.
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  });
  return _smtp;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const provider = resolveEmailProvider();
  const from = fromAddress();

  if (provider === 'stub') {
    console.warn('[email] no email provider configured — email NOT sent:', {
      to: params.to,
      subject: params.subject,
    });
    return;
  }

  if (provider === 'smtp') {
    const transport = smtpTransport();
    if (!transport) {
      console.warn('[email] EMAIL_PROVIDER=smtp but SMTP_HOST/USER/PASS not fully set — email NOT sent:', {
        to: params.to,
        subject: params.subject,
      });
      return;
    }
    // nodemailer throws on connection/auth/relay errors, so a failure here
    // propagates to the caller (callers wrap sends in Promise.allSettled).
    const info = await transport.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    console.log('[email] sent via smtp', { id: info.messageId, to: params.to, subject: params.subject });
    return;
  }

  // provider === 'resend'
  const resend = resendClient();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — email NOT sent:', {
      to: params.to,
      subject: params.subject,
    });
    return;
  }
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
  console.log('[email] sent via resend', { id: data?.id, to: params.to, subject: params.subject });
}

// ---- Notification dispatch helpers -----------------------------------------
// Thin wrappers around the events the product cares about. These are called
// from server actions / webhooks. Channel selection (sms/email/push) per user
// is read from notification_prefs by the caller.

export const notifications = {
  bidAccepted(to: { phone?: string; email?: string }, listingArea: string) {
    const msg = `Ten2Ten: по вашему объявлению (${listingArea}) отправлен запрос. Откройте приложение, чтобы написать и договориться о просмотре. У вас есть 24 часа.`;
    if (to.phone) return sendSms(to.phone, msg);
  },
  listingFreed(to: { phone?: string; email?: string }, listingArea: string) {
    const msg = `Ten2Ten: квартира из избранного (${listingArea}) снова доступна. Кто первым отправит запрос — тому и достанется.`;
    if (to.phone) return sendSms(to.phone, msg);
  },
  expiryWarning(to: { phone?: string }, hoursLeft: number) {
    if (to.phone)
      return sendSms(
        to.phone,
        `Ten2Ten: ваш чат истекает через ${hoursLeft} ч. Отправьте сообщение, чтобы сохранить его активным.`
      );
  },
};
