'use client';

import { useState, FormEvent } from 'react';
import type { Locale } from '@/i18n/config';

const T = {
  ru: {
    title: 'Написать в поддержку',
    subtitle: 'Опишите вопрос — мы ответим на ваш email. Имя и ссылки на чат и объявление подставятся автоматически.',
    subjectLabel: 'Тема (необязательно)',
    subjectPlaceholder: 'Коротко о вопросе',
    messageLabel: 'Сообщение',
    messagePlaceholder: 'Расскажите, что случилось…',
    send: 'Отправить',
    sending: 'Отправляем…',
    success: 'Спасибо! Мы получили ваше сообщение и ответим на email.',
    errorEmpty: 'Напишите сообщение.',
    errorGeneric: 'Не удалось отправить. Попробуйте ещё раз или напишите на support@ten2ten.ru.',
    directLine: 'Или напишите напрямую:',
  },
  en: {
    title: 'Contact support',
    subtitle: "Describe your question — we'll reply to your email. Your name and links to your chat and listing are attached automatically.",
    subjectLabel: 'Subject (optional)',
    subjectPlaceholder: 'A short summary',
    messageLabel: 'Message',
    messagePlaceholder: 'Tell us what happened…',
    send: 'Send',
    sending: 'Sending…',
    success: "Thanks! We got your message and will reply by email.",
    errorEmpty: 'Please write a message.',
    errorGeneric: "Couldn't send. Please try again or email support@ten2ten.ru.",
    directLine: 'Or email us directly:',
  },
} as const;

export default function SupportView({ locale }: { locale: Locale }) {
  const t = T[locale] ?? T.ru;
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!message.trim()) {
      setError(t.errorEmpty);
      return;
    }
    setStatus('sending');
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!res.ok || !data.ok) {
        setStatus('idle');
        setError(t.errorGeneric);
        return;
      }
      setStatus('sent');
    } catch {
      setStatus('idle');
      setError(t.errorGeneric);
    }
  }

  const fieldClass =
    'w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-ink placeholder:text-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-cobalt';

  return (
    <main className="mx-auto max-w-lg px-5 py-16">
      <h1 className="mb-2 font-display text-3xl text-ink">{t.title}</h1>
      <p className="mb-8 text-sm leading-relaxed text-muted">{t.subtitle}</p>

      {status === 'sent' ? (
        <p className="rounded-lg border border-leaf/30 bg-leaf/10 px-4 py-3 text-sm text-leaf">{t.success}</p>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <div>
            <label htmlFor="support-subject" className="mb-1.5 block text-sm text-muted">
              {t.subjectLabel}
            </label>
            <input
              id="support-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t.subjectPlaceholder}
              maxLength={140}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="support-message" className="mb-1.5 block text-sm text-muted">
              {t.messageLabel}
            </label>
            <textarea
              id="support-message"
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.messagePlaceholder}
              rows={6}
              maxLength={5000}
              className={`${fieldClass} resize-y`}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full rounded-lg bg-gradient-cobalt px-5 py-3 font-medium text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {status === 'sending' ? t.sending : t.send}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        {t.directLine}{' '}
        <a href="mailto:support@ten2ten.ru" className="text-cobalt hover:underline">
          support@ten2ten.ru
        </a>
      </p>
    </main>
  );
}
