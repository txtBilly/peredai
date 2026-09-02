'use client';

import { useState, FormEvent, Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { getDictionary } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

// Bump when Terms/Privacy/Identity Consent copy changes materially. Kept in sync
// with CONSENT_VERSION in /api/auth/signup.
const LANGUAGE_OPTIONS = [
  { value: 'ru', label: 'Русский' },
  { value: 'uz', label: 'Oʻzbekcha' },
  { value: 'tg', label: 'Тоҷикӣ' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
  { value: 'ar', label: 'العربية' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'pt', label: 'Português' },
  { value: 'ko', label: '한국어' },
];

// New-flow copy that isn't in the shared dictionaries yet. Kept inline (bilingual)
// to avoid a dictionary migration for a handful of strings.
const T = {
  ru: {
    subtitle:
      'Укажите email — на следующем шаге вы подтвердите личность через Сбер ID или Т-Банк, и ваше имя подставится автоматически. Пароль не нужен: вход всегда через банк.',
    continue: 'Продолжить',
    invalidEmail: 'Введите корректный email.',
  },
  en: {
    subtitle:
      'Enter your email — next you’ll confirm your identity with Sber ID or T-Bank, and your name fills in automatically. No password: you always sign in with your bank.',
    continue: 'Continue',
    invalidEmail: 'Enter a valid email.',
  },
} as const;

function renderTemplate(template: string, tokens: Record<string, ReactNode>) {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const match = part.match(/^\{(\w+)\}$/);
    return <Fragment key={i}>{match ? tokens[match[1]] : part}</Fragment>;
  });
}

export default function SignUpView({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const d = getDictionary(locale);
  const t = T[locale] ?? T.ru;

  const [email, setEmail] = useState('');
  const [spokenLanguages, setSpokenLanguages] = useState<string[]>(['ru']);
  const [consented, setConsented] = useState(false);
  // Separate 152-ФЗ personal-data-processing consent (its own checkbox + doc).
  const [pdConsented, setPdConsented] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle');
  const [error, setError] = useState('');

  function toggleLanguage(lang: string) {
    // Russian is the baseline language — always selected, not removable.
    if (lang === 'ru') return;
    setSpokenLanguages((cur) =>
      cur.includes(lang) ? (cur.length > 1 ? cur.filter((l) => l !== lang) : cur) : [...cur, lang]
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t.invalidEmail);
      return;
    }
    if (!consented) {
      setError(d.auth.consentRequired);
      return;
    }
    if (!pdConsented) {
      setError(d.auth.consentPdRequired);
      return;
    }

    setStatus('submitting');
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          spokenLanguages,
          consent: consented,
          locale,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; next?: string; error?: string };
      if (!res.ok || !data.ok) {
        setStatus('idle');
        if (data.error === 'account_exists') setError(d.auth.errorEmailExists);
        else if (data.error === 'invalid_email') setError(t.invalidEmail);
        else if (data.error === 'consent_required') setError(d.auth.consentRequired);
        else setError(d.auth.errorGeneric);
        return;
      }
      // Full navigation so the freshly-minted session cookie is picked up everywhere
      // (middleware + the verify page) before the mandatory identity step.
      window.location.assign(data.next ?? `/${locale}/verify`);
    } catch {
      setStatus('idle');
      setError(d.auth.errorGeneric);
    }
  }

  const fieldClass =
    'w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-ink placeholder:text-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-cobalt';
  const labelClass = 'mb-1.5 block text-sm text-muted';

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-5 py-16">
      <h1 className="mb-8 font-display text-3xl text-ink">{d.auth.signUp}</h1>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div>
          <label htmlFor="email" className={labelClass}>
            {d.auth.emailLabel}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={d.auth.emailPlaceholder}
            className={fieldClass}
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm text-muted">{d.onboarding.languagesLabel}</legend>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map(({ value, label }) => {
              // Russian is the baseline language — always selected, not removable.
              const locked = value === 'ru';
              return (
                <label
                  key={value}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    locked ? 'cursor-default' : 'cursor-pointer'
                  } ${
                    spokenLanguages.includes(value)
                      ? 'border-cobalt bg-gradient-cobalt text-white'
                      : 'border-black/15 text-muted hover:border-black/30 hover:text-ink'
                  }`}
                >
                  <input
                    type="checkbox"
                    value={value}
                    checked={spokenLanguages.includes(value)}
                    disabled={locked}
                    onChange={() => toggleLanguage(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <label className="flex items-start gap-3 text-sm text-muted">
          <input
            type="checkbox"
            required
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-black/30 bg-white accent-cobalt"
          />
          <span>
            {renderTemplate(d.auth.consentTemplate, {
              terms: (
                <Link href={`/${locale}/terms`} className="font-medium text-cobalt underline underline-offset-2 hover:opacity-80">
                  {d.auth.consentTermsLabel}
                </Link>
              ),
              privacy: (
                <Link href={`/${locale}/privacy`} className="font-medium text-cobalt underline underline-offset-2 hover:opacity-80">
                  {d.auth.consentPrivacyLabel}
                </Link>
              ),
              identity: (
                <Link href={`/${locale}/identity-consent`} className="font-medium text-cobalt underline underline-offset-2 hover:opacity-80">
                  {d.auth.consentIdentityLabel}
                </Link>
              ),
            })}
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm text-muted">
          <input
            type="checkbox"
            required
            checked={pdConsented}
            onChange={(e) => setPdConsented(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-black/30 bg-white accent-cobalt"
          />
          <span>
            {renderTemplate(d.auth.consentPdTemplate, {
              pd: (
                <Link
                  href={`/${locale}/personal-data-consent`}
                  className="font-medium text-cobalt underline underline-offset-2 hover:opacity-80"
                >
                  {d.auth.consentPdLabel}
                </Link>
              ),
            })}
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={status === 'submitting' || !consented || !pdConsented}
          className="w-full rounded-lg bg-gradient-cobalt px-5 py-3 font-medium text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {status === 'submitting' ? d.auth.signingUp : t.continue}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {d.auth.haveAccount}{' '}
        <Link href={`/${locale}/signin`} className="font-medium text-cobalt underline underline-offset-2 hover:opacity-80">
          {d.auth.signInLink}
        </Link>
      </p>
    </main>
  );
}
