'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getDictionary } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

export default function DeletePage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const d = getDictionary(locale);
  const del = d.delete;
  const router = useRouter();

  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'deleting'>('idle');
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting'>('idle');
  const [guard, setGuard] = useState<'active_chat' | 'active_listing' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push(`/${locale}/signin`); return; }

      const [{ data: chats }, { data: listings }] = await Promise.all([
        supabase
          .from('chats')
          .select('id')
          .or(`seeker_id.eq.${user.id},lister_id.eq.${user.id}`)
          .eq('status', 'active')
          .limit(1),
        supabase
          .from('listings')
          .select('id')
          .eq('lister_id', user.id)
          .in('status', ['active', 'negotiating'])
          .limit(1),
      ]);

      if (chats && chats.length > 0) setGuard('active_chat');
      else if (listings && listings.length > 0) setGuard('active_listing');
    });
  }, [locale, router]);

  async function handleExport() {
    setExportStatus('exporting');
    const res = await fetch('/api/account/export');
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ten2ten-data-export.json';
      a.click();
      URL.revokeObjectURL(url);
    }
    setExportStatus('idle');
  }

  async function handleDelete(e: FormEvent) {
    e.preventDefault();
    if (confirm !== 'DELETE') return;
    setError('');
    setStatus('deleting');

    const res = await fetch('/api/account/delete', { method: 'POST' });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body.error === 'active_chat') setGuard('active_chat');
      else if (body.error === 'active_listing') setGuard('active_listing');
      else setError(del.errorGeneric);
      setStatus('idle');
      return;
    }

    // Auth user is gone — sign out and redirect home
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${locale}`);
  }

  const canDelete = confirm === 'DELETE' && !guard && status === 'idle';

  return (
    <main className="mx-auto max-w-lg px-5 py-16">
      <p className="mb-1 text-sm uppercase tracking-wide text-cobalt">Ten2Ten</p>
      <div className="mb-8 flex items-center gap-3">
        <Link href={`/${locale}/account`} className="text-muted hover:text-ink" aria-label={d.common.back}>‹</Link>
        <h1 className="font-display text-3xl text-ink">{del.title}</h1>
      </div>

      {/* Warning */}
      <p className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
        {del.warning}
      </p>

      {/* Guard notices */}
      {guard === 'active_chat' && (
        <p role="alert" className="mb-6 rounded-xl border border-cobalt/30 bg-cobalt/10 px-4 py-3 text-sm text-cobalt">
          {del.guardActiveChat}
        </p>
      )}
      {guard === 'active_listing' && (
        <p role="alert" className="mb-6 rounded-xl border border-cobalt/30 bg-cobalt/10 px-4 py-3 text-sm text-cobalt">
          {del.guardActiveListing}
        </p>
      )}

      {/* Export */}
      <button
        type="button"
        onClick={handleExport}
        disabled={exportStatus === 'exporting'}
        className="mb-8 w-full rounded-lg border border-black/15 px-5 py-3 text-sm text-muted transition hover:border-black/30 hover:text-ink disabled:opacity-50"
      >
        {exportStatus === 'exporting' ? del.exporting : del.exportCta}
      </button>

      {/* Confirm + delete */}
      <form onSubmit={handleDelete} noValidate className="flex flex-col gap-4">
        <div>
          <label htmlFor="confirm-input" className="mb-1.5 block text-sm text-muted">
            {del.confirmLabel}
          </label>
          <input
            id="confirm-input"
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={del.confirmPlaceholder}
            autoComplete="off"
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-ink placeholder:text-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canDelete}
          className="w-full rounded-lg bg-red-600 px-5 py-3 font-medium text-white transition hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === 'deleting' ? del.deleting : del.deleteCta}
        </button>
      </form>
    </main>
  );
}
