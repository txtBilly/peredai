import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// Staff-only admin area (non-localized). The root layout is a pass-through, so
// this provides its own html/body. Access is enforced server-side here (and in
// every /api/admin route); never client-only.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect('/en/signin');

  const supabase = createClient();
  const { data: profile } = await supabase.from('profiles').select('is_staff').eq('id', user.id).maybeSingle();
  if (!profile?.is_staff) redirect('/en/browse');

  return (
    <div className="min-h-screen bg-ink text-paper">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-4">
          <span className="font-display text-lg text-gold">Ten2Ten Admin</span>
          <nav className="flex gap-4 text-sm text-muted">
            <Link href="/admin" className="hover:text-paper">Reports</Link>
            <Link href="/admin/listings" className="hover:text-paper">Suspended</Link>
            <Link href="/admin/users" className="hover:text-paper">Users</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
