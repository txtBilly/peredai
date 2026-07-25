'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { getDictionary } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

// Lister identity verification: upload a government-ID photo (stored privately),
// then auto-verify (mock stand-in for a KYC vendor). Seekers don't use this —
// they verify via the background check at Connect. Copy is functional pending
// the copy sweep.
export default function VerifyPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { next?: string };
}) {
  const locale = params.locale as Locale;
  const d = getDictionary(locale);
  const v = d.verify;
  const router = useRouter();
  const nextPath = `/${locale}/${searchParams?.next?.replace(/^\/+/, '') || 'account'}`;

  const [status, setStatus] = useState<'unverified' | 'verified'>('unverified');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace(`/${locale}/signin`);
        return;
      }
      supabase
        .from('profiles')
        .select('verification_status')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.verification_status === 'verified') setStatus('verified');
          setLoading(false);
        });
    });
  }, [locale, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image of your ID.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('That image is too large (max 10MB).');
      return;
    }
    setError('');
    setSubmitting(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace(`/${locale}/signin`);
      return;
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${user.id}/id-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('id-documents').upload(path, file, { upsert: true });
    if (upErr) {
      setError(v.errorGeneric);
      setSubmitting(false);
      return;
    }

    const res = await fetch('/api/identity/verify-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(v.errorGeneric);
      return;
    }
    setStatus('verified');
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-5">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </main>
    );
  }

  if (status === 'verified') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 py-16 text-center">
        <p className="mb-4 text-sm uppercase tracking-wide text-gold">Ten2Ten</p>
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-sage/20">
          <span className="text-2xl text-sage">✓</span>
        </div>
        <h1 className="mb-2 font-display text-3xl text-paper">{v.successTitle}</h1>
        <VerifiedBadge className="mb-4" />
        <p className="mb-8 text-sm text-muted">{v.successBody}</p>
        <button
          onClick={() => router.push(nextPath)}
          className="w-full rounded-lg bg-gold px-5 py-3 font-medium text-ink transition hover:brightness-110"
        >
          {v.continueCta}
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16">
      <p className="mb-4 text-sm uppercase tracking-wide text-gold">Ten2Ten</p>
      <h1 className="mb-2 font-display text-3xl text-paper">{v.title}</h1>
      <p className="mb-8 text-sm text-muted">
        Upload a clear photo of your government ID to verify you're a real person before you list. Your ID is stored
        privately and never shown to other members.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-white/20 bg-ink/40 px-4 py-8 text-center text-sm text-muted hover:border-white/40">
          <span className="text-paper">{file ? file.name : 'Choose an ID photo'}</span>
          <span className="text-xs">JPG or PNG, up to 10MB</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!file || submitting}
          className="w-full rounded-lg bg-gold px-5 py-3 font-medium text-ink transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? v.starting : 'Upload & verify'}
        </button>
      </form>
    </main>
  );
}
