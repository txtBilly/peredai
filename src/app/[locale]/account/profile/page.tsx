'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getDictionary } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

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

export default function EditProfilePage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const d = getDictionary(locale);
  const p = d.profile;
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [displayFirstName, setDisplayFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [spokenLanguages, setSpokenLanguages] = useState<string[]>(['ru']);
  const [preferredLocale, setPreferredLocale] = useState<'en' | 'ru'>(locale);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [nameLocked, setNameLocked] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push(`/${locale}/signin`); return; }
      supabase
        .from('profiles')
        .select('full_name, display_first_name, phone, spoken_languages, preferred_locale, bg_check_completed_at, bg_check_expires_at, identity_verified_at')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setFullName(data.full_name ?? '');
            setDisplayFirstName(data.display_first_name ?? '');
            setPhone(data.phone ?? '');
            setSpokenLanguages(data.spoken_languages ?? ['en']);
            setPreferredLocale((data.preferred_locale as 'en' | 'ru') ?? locale);
            // Legal name locks once identity has *ever* been verified — by the
            // background check (seekers) OR the Stripe Identity ID check
            // (listers) — and stays locked even after the 60-day check expires.
            // Matches the lock_verified_full_name DB trigger, which now keys off
            // both bg_check_completed_at and identity_verified_at.
            setNameLocked(!!data.bg_check_completed_at || !!data.identity_verified_at);
          }
          setLoading(false);
        });
    });
  }, [locale, router]);

  function toggleLanguage(lang: string) {
    setSpokenLanguages((cur) =>
      cur.includes(lang)
        ? cur.length > 1 ? cur.filter((l) => l !== lang) : cur
        : [...cur, lang]
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!/^\+[1-9]\d{7,14}$/.test(phone.replace(/\s/g, ''))) {
      setError(p.errorPhone);
      return;
    }
    setStatus('saving');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push(`/${locale}/signin`); return; }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        // Omit full_name when locked — the field is disabled in the UI and the
        // DB trigger would reject the change anyway.
        ...(nameLocked ? {} : { full_name: fullName.trim() }),
        display_first_name: displayFirstName.trim(),
        phone: phone.replace(/\s/g, ''),
        spoken_languages: spokenLanguages,
        preferred_locale: preferredLocale,
      })
      .eq('id', user.id);

    if (updateError) {
      setError(p.errorGeneric);
      setStatus('idle');
      return;
    }
    setStatus('saved');
    setTimeout(() => setStatus('idle'), 3000);
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-5">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cobalt border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-5 py-16">
      <p className="mb-1 text-sm uppercase tracking-wide text-cobalt">Ten2Ten</p>
      <div className="mb-8 flex items-center gap-3">
        <Link href={`/${locale}/account`} className="text-muted hover:text-ink" aria-label={d.common.back}>‹</Link>
        <h1 className="font-display text-3xl text-ink">{p.title}</h1>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div>
          <label htmlFor="full-name" className="mb-1.5 block text-sm text-muted">{p.fullNameLabel}</label>
          <input
            id="full-name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={nameLocked}
            aria-describedby={nameLocked ? 'full-name-locked' : undefined}
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-ink placeholder:text-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-cobalt disabled:cursor-not-allowed disabled:opacity-60"
          />
          {nameLocked && (
            <p id="full-name-locked" className="mt-1.5 text-xs text-muted">
              Verified — your legal name is locked and can’t be changed.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="display-name" className="mb-1.5 block text-sm text-muted">{p.displayNameLabel}</label>
          <input
            id="display-name"
            type="text"
            autoComplete="given-name"
            value={displayFirstName}
            onChange={(e) => setDisplayFirstName(e.target.value)}
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-ink placeholder:text-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
          />
        </div>

        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm text-muted">{p.phoneLabel}</label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-ink placeholder:text-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm text-muted">{p.languagesLabel}</legend>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition ${
                  spokenLanguages.includes(value)
                    ? 'border-cobalt bg-gradient-cobalt text-white'
                    : 'border-black/15 text-muted hover:border-black/30 hover:text-ink'
                }`}
              >
                <input type="checkbox" value={value} checked={spokenLanguages.includes(value)}
                  onChange={() => toggleLanguage(value)} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="locale" className="mb-1.5 block text-sm text-muted">{p.localeLabel}</label>
          <select
            id="locale"
            value={preferredLocale}
            onChange={(e) => setPreferredLocale(e.target.value as 'en' | 'ru')}
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-ink outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
          >
            <option value="ru" className="bg-white">{p.localeRu}</option>
            <option value="en" className="bg-white">{p.localeEn}</option>
          </select>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {status === 'saved' && (
          <p role="status" className="rounded-lg border border-leaf/30 bg-leaf/10 px-3 py-2 text-sm text-leaf">
            {p.saved}
          </p>
        )}

        <button
          type="submit"
          disabled={status === 'saving'}
          className="w-full rounded-lg bg-gradient-cobalt px-5 py-3 font-medium text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {status === 'saving' ? p.saving : p.save}
        </button>
      </form>
    </main>
  );
}
