// Single source of truth for the current revision of the legal documents users
// must accept (Пользовательское соглашение, Политика конфиденциальности, согласия).
//
// Versions are named by YEAR-MONTH (YYYY-MM) rather than a running number, so the
// version string doubles as a human-readable "current since" date — you can tell at
// a glance what's live and when it last changed. Bump this AND the redaction label
// shown on the legal pages whenever the documents change materially.
//
// When the stored consent_version on a user's account (user_metadata) no longer
// equals CURRENT_CONSENT_VERSION, the middleware routes them through /reconsent to
// accept the updated documents before they can continue.
export const CURRENT_CONSENT_VERSION = '2026-09';

// Human-readable label for the current revision, shown on the legal pages and the
// re-consent prompt. Keep in the same month as CURRENT_CONSENT_VERSION.
export const CONSENT_REVISION_LABEL = {
  ru: 'сентябрь 2026',
  en: 'September 2026',
} as const;
