'use client';

import { useState, FormEvent, Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { getDictionary } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { CONSENT_REVISION_LABEL } from '@/lib/consent';

// Copy specific to the re-consent screen (not in the shared dictionaries). The
// checkbox labels themselves are reused from d.auth.* so they stay in sync with
// the signup form.
const T = {
  ru: {
    title: 'Мы обновили документы',
    body: 'Мы обновили правовые документы Ten2Ten. Чтобы продолжить пользоваться сервисом, пожалуйста, ознакомьтесь с ними и подтвердите согласие.',
    revision: (label: string) => `Действующая редакция: ${label}`,
    submit: 'Принять и продолжить',
    submitting: 'Сохраняем…',
    error: 'Не удалось сохранить. Попробуйте ещё раз.',
  },
  en: {
    title: 'We’ve updated our documents',
    body: 'We have updated Ten2Ten’s legal documents. To keep using the service, please review them and confirm your consent.',
    revision: (label: string) => `Current revision: ${label}`,
    submit: 'Accept and continue',
    submitting: 'Saving…',
    error: 'Could not save. Please try again.',
  },
} as const;

function renderTemplate(template: string, tokens: Record<string, ReactNode>) {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const match = part.match(/^\{(\w+)\}$/);
    return <Fragment key={i}>{match ? tokens[match[1]] : part}</Fragment>;
  });
}

// Only allow a same-site absolute path as the post-consent redirect target.
function safeNext(raw: string | null, fallback: string): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return fallback;
}

export default function ReconsentView({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const d = getDictionary(locale);
  const t = T[locale] ?? T.ru;

  const [consented, setConsented] = useState(false);
  const [pdConsented, setPdConsented] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
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
      const res = await fetch('/api/auth/reconsent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: consented, pdConsent: pdConsented }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!res.ok || !data.ok) {
        setStatus('idle');
        setError(t.error);
        return;
      }
      const next = safeNext(new URLSearchParams(window.location.search).get('next'), `/${locale}/browse`);
      window.location.assign(next);
    } catch {
      setStatus('idle');
      setError(t.error);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-5 py-16">
      <h1 className="mb-2 font-display text-3xl text-ink">{t.title}</h1>
      <p className="mb-2 text-sm text-muted">{t.body}</p>
      <p className="mb-8 text-xs text-muted/80">{t.revision(CONSENT_REVISION_LABEL[locale] ?? CONSENT_REVISION_LABEL.ru)}</p>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
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
                <Link href={`/${locale}/personal-data-consent`} className="font-medium text-cobalt underline underline-offset-2 hover:opacity-80">
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
          {status === 'submitting' ? t.submitting : t.submit}
        </button>
      </form>
    </main>
  );
}
