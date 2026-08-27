import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { mintSessionForEmail } from '@/lib/auth-session';
import { isLocale, defaultLocale } from '@/i18n/config';

// Bumped when the consent structure changes materially. '-pd' marks the split
// into a separate 152-ФЗ personal-data-processing consent (Sept-2025 rule).
const CONSENT_VERSION = '2026-01-ru-pd';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// New RU signup — the ONLY typed fields are email, spoken language(s), and the
// consent checkbox. No password and no name: the account is passwordless (users
// sign in with Sber ID / T-ID), and the legal name is populated from the bank at
// verification. We create the account, mint a session, and hand the client the
// path to the mandatory Sber/T-ID step.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    spokenLanguages?: unknown;
    consent?: unknown;
    locale?: string;
  };

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }
  if (body.consent !== true) {
    return NextResponse.json({ error: 'consent_required' }, { status: 400 });
  }
  const locale = typeof body.locale === 'string' && isLocale(body.locale) ? body.locale : defaultLocale;
  const spoken = Array.isArray(body.spokenLanguages)
    ? (body.spokenLanguages as unknown[]).filter((l): l is string => typeof l === 'string')
    : [];
  const langs = spoken.length ? spoken : ['ru'];

  const admin = createAdminClient();
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true, // passwordless account; the bank identity is the real proof, not the email
    user_metadata: {
      preferred_locale: locale,
      spoken_languages: langs,
      consent_version: CONSENT_VERSION,
      consented_at: new Date().toISOString(),
    },
  });

  if (createErr) {
    const m = (createErr.message ?? '').toLowerCase();
    if (m.includes('already') || m.includes('registered') || m.includes('exist')) {
      // Email already has an account — they should log in with Sber/T-ID instead.
      return NextResponse.json({ error: 'account_exists' }, { status: 409 });
    }
    console.error('[auth/signup] createUser failed', createErr);
    return NextResponse.json({ error: 'signup_failed' }, { status: 500 });
  }

  const minted = await mintSessionForEmail(email);
  if (!minted.ok) {
    console.error('[auth/signup] session mint failed', minted.error);
    return NextResponse.json({ error: 'session_failed' }, { status: 500 });
  }

  // Signed in (unverified). Client routes them straight into mandatory verification.
  return NextResponse.json({ ok: true, next: `/${locale}/verify?next=browse` });
}
