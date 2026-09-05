'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { getDictionary } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

const T = {
  ru: {
    heading: 'Добро пожаловать',
    subtitle: 'Регистрация и вход — через Сбер ID или Т-Банк. Пароль не нужен.',
    registerCta: 'Зарегистрироваться',
    mockLabel: 'Тестовый вход (по email)',
    mockCta: 'Войти',
    starting: 'Открываем…',
    noAccount: 'Аккаунт с этой личностью не найден. Сначала зарегистрируйтесь.',
    error: 'Не удалось войти. Попробуйте ещё раз.',
    emailPlaceholder: 'you@example.com',
  },
  en: {
    heading: 'Welcome',
    subtitle: 'Sign up or sign in — with Sber ID or T-Bank. No password needed.',
    registerCta: 'Sign up',
    mockLabel: 'Test sign-in (by email)',
    mockCta: 'Sign in',
    starting: 'Opening…',
    noAccount: 'No account found for this identity. Please sign up first.',
    error: 'Sign-in failed. Please try again.',
    emailPlaceholder: 'you@example.com',
  },
} as const;

export default function SignInView({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const d = getDictionary(locale);
  const v = d.verify;
  const t = T[locale] ?? T.ru;

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle');
  const [error, setError] = useState('');
  const [nextPath, setNextPath] = useState('');

  // Surface an error passed back from the OAuth callback (?error=...), and carry
  // any ?next=... through to the sign-up link so registration returns the user
  // to what they were doing.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const e = params.get('error');
    if (e === 'no_account') setError(t.noAccount);
    else if (e) setError(t.error);
    setNextPath(params.get('next') ?? '');
  }, [t]);

  // New visitors register by default; returning users on the same device are
  // remembered by their bank (Sber ID / T-Bank), so signing in is a quick tap
  // from the secondary option below. That's why "Зарегистрироваться" leads here.
  const signUpHref = `/${locale}/signup${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ''}`;

  const providers = (process.env.NEXT_PUBLIC_IDENTITY_PROVIDERS ?? 'mock')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const bankProviders = providers.filter((p) => p === 'sber' || p === 'tid');
  const mockEnabled = providers.includes('mock');
  const providerLabel = (p: string) =>
    p === 'sber' ? v.providerSber : p === 'tid' ? v.providerTid : v.providerMock;

  async function loginBank(provider: string) {
    setError('');
    setStatus('submitting');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, locale }),
      });
      const data = (await res.json().catch(() => ({}))) as { redirectUrl?: string };
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      setStatus('idle');
      setError(t.error);
    } catch {
      setStatus('idle');
      setError(t.error);
    }
  }

  async function loginMock(e: FormEvent) {
    e.preventDefault();
    setError('');
    setStatus('submitting');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'mock', email: email.trim().toLowerCase(), locale }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; next?: string; error?: string };
      if (!res.ok || !data.ok) {
        setStatus('idle');
        setError(data.error === 'no_account' ? t.noAccount : t.error);
        return;
      }
      window.location.assign(data.next ?? `/${locale}/browse`);
    } catch {
      setStatus('idle');
      setError(t.error);
    }
  }

  const fieldClass =
    'w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-ink placeholder:text-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-cobalt';

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-12">
      <h1 className="mb-2 font-display text-3xl font-bold text-ink">{t.heading}</h1>
      <p className="mb-8 text-sm text-muted">{t.subtitle}</p>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Primary path: register. Most people reaching this screen are new; the
          bank sign-in for returning users sits below as the secondary option. */}
      <Link
        href={signUpHref}
        className="w-full rounded-lg bg-gradient-cobalt px-5 py-3 text-center font-medium text-white transition hover:brightness-110"
      >
        {t.registerCta}
      </Link>

      {/* Secondary path: existing users sign in with their bank. */}
      {bankProviders.length > 0 && (
        <div className="mt-6 flex flex-col gap-2.5">
          <p className="text-center text-sm text-muted">{d.auth.haveAccount}</p>
          {bankProviders.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => loginBank(p)}
              disabled={status === 'submitting'}
              className="w-full rounded-lg border border-black/15 px-5 py-3 font-medium text-ink transition hover:border-black/40 hover:bg-black/[0.03] disabled:opacity-50"
            >
              {status === 'submitting' ? t.starting : providerLabel(p)}
            </button>
          ))}
        </div>
      )}

      {mockEnabled && (
        <form onSubmit={loginMock} className="mt-5 flex flex-col gap-2">
          <label htmlFor="mock-email" className="text-sm text-muted">
            {t.mockLabel}
          </label>
          <input
            id="mock-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.emailPlaceholder}
            className={fieldClass}
          />
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full rounded-lg border border-black/15 px-5 py-2.5 text-sm font-medium text-ink transition hover:border-black/40 hover:bg-black/[0.03] disabled:opacity-50"
          >
            {t.mockCta}
          </button>
        </form>
      )}
    </main>
  );
}
