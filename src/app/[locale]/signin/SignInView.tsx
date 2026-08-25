'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { getDictionary } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

const T = {
  ru: {
    subtitle: 'Вход через ваш банк — Сбер ID или Т-Банк. Пароль не нужен.',
    loginWith: 'Войти через',
    mockLabel: 'Тестовый вход (по email)',
    mockCta: 'Войти',
    starting: 'Открываем…',
    noAccount: 'Аккаунт с этой личностью не найден. Сначала зарегистрируйтесь.',
    error: 'Не удалось войти. Попробуйте ещё раз.',
    emailPlaceholder: 'you@example.com',
    noAccountPrompt: 'Нет аккаунта?',
    signUpLink: 'Зарегистрироваться',
  },
  en: {
    subtitle: 'Sign in with your bank — Sber ID or T-Bank. No password needed.',
    loginWith: 'Sign in with',
    mockLabel: 'Test sign-in (by email)',
    mockCta: 'Sign in',
    starting: 'Opening…',
    noAccount: 'No account found for this identity. Please sign up first.',
    error: 'Sign-in failed. Please try again.',
    emailPlaceholder: 'you@example.com',
    noAccountPrompt: 'No account?',
    signUpLink: 'Sign up',
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

  // Surface an error passed back from the OAuth callback (?error=...).
  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get('error');
    if (e === 'no_account') setError(t.noAccount);
    else if (e) setError(t.error);
  }, [t]);

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
      <h1 className="mb-2 font-display text-3xl font-bold text-ink">{d.auth.signIn}</h1>
      <p className="mb-8 text-sm text-muted">{t.subtitle}</p>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        {bankProviders.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => loginBank(p)}
            disabled={status === 'submitting'}
            className="w-full rounded-lg bg-gradient-cobalt px-5 py-3 font-medium text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {status === 'submitting' ? t.starting : providerLabel(p)}
          </button>
        ))}
      </div>

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

      <p className="mt-6 text-center text-sm text-muted">
        {t.noAccountPrompt}{' '}
        <Link href={`/${locale}/signup`} className="text-ink underline-offset-2 hover:underline">
          {t.signUpLink}
        </Link>
      </p>
    </main>
  );
}
