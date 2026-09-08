import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/adminAuth';

// Staff-only admin area (non-localized). The root layout is a pass-through, so
// this provides its own html/body. Access is enforced server-side here (and in
// every /api/admin route); never client-only.
//
// Admins sign in at /admin/login — a dedicated email+password door, separate
// from the consumer Sber ID flow. Who's allowed is the ADMIN_EMAILS allowlist
// (with legacy is_staff as a fallback).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The login route lives under /admin too, so it must bypass the staff gate —
  // otherwise it would redirect to itself. Middleware forwards the request path
  // as x-pathname so we can detect it here.
  const path = headers().get('x-pathname') ?? '';
  if (path === '/admin/login' || path.startsWith('/admin/login/')) {
    return <div className="min-h-screen bg-ink text-paper">{children}</div>;
  }

  const user = await getUser();
  if (!user) redirect('/admin/login');

  let allowed = isAdminEmail(user.email);
  if (!allowed) {
    const supabase = createClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_staff')
      .eq('id', user.id)
      .maybeSingle();
    allowed = !!profile?.is_staff;
  }
  if (!allowed) redirect('/admin/login?denied=1');

  return (
    <div className="min-h-screen bg-ink text-paper">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-4">
          <span className="font-display text-lg text-gold">Ten2Ten · Админ</span>
          <nav className="flex flex-1 gap-4 text-sm text-muted">
            <Link href="/admin" className="hover:text-paper">Жалобы</Link>
            <Link href="/admin/listings" className="hover:text-paper">Скрытые</Link>
            <Link href="/admin/users" className="hover:text-paper">Пользователи</Link>
            <Link href="/admin/coupons" className="hover:text-paper">Промокоды</Link>
            <Link href="/admin/analytics" className="hover:text-paper">Аналитика</Link>
            <Link href="/admin/tochka" className="hover:text-paper">Оплата</Link>
          </nav>
          <form action="/api/admin/logout" method="post">
            <button type="submit" className="text-sm text-muted hover:text-paper">
              Выйти
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
