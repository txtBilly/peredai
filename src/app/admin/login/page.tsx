export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  missing: 'Введите e-mail и пароль.',
  invalid: 'Неверный e-mail или пароль.',
  not_admin: 'У этого аккаунта нет доступа к админке.',
};

// Dedicated admin sign-in — email + password, independent of the consumer Sber
// ID flow. The form posts to /api/admin/login, which verifies the credentials
// against Supabase and checks the e-mail against the ADMIN_EMAILS allowlist.
export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: { error?: string; denied?: string };
}) {
  const message = searchParams.error
    ? ERRORS[searchParams.error] ?? 'Не удалось войти.'
    : searchParams.denied
      ? 'Нужен вход администратора.'
      : null;

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl text-gold">Ten2Ten · Админ</h1>
        <p className="mt-1 text-sm text-muted">Вход для сотрудников.</p>

        {message && (
          <p className="mt-4 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-300">{message}</p>
        )}

        <form action="/api/admin/login" method="post" className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs text-muted" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-paper outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted" htmlFor="password">
              Пароль
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-paper outline-none focus:border-gold"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-gold px-4 py-2 text-sm font-medium text-ink transition hover:opacity-90"
          >
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}
