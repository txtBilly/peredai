import { getUser } from './auth';
import { createClient } from './supabase/server';

// Admin allowlist. Staff sign in at /admin/login with an email+password Supabase
// account whose e-mail is listed (comma-separated) in ADMIN_EMAILS. This is the
// primary gate — it's independent of the consumer Sber ID / magic-link flow. The
// legacy profiles.is_staff flag is still honored as a fallback so any account
// previously promoted keeps working.
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

// Returns the signed-in user iff they're an admin (allowlisted e-mail, or the
// legacy is_staff flag), else null. Use in every /api/admin route — server-side
// authorization, never trust the client.
export async function requireStaff() {
  const user = await getUser();
  if (!user) return null;
  if (isAdminEmail(user.email)) return user;
  const supabase = createClient();
  const { data } = await supabase.from('profiles').select('is_staff').eq('id', user.id).maybeSingle();
  return data?.is_staff ? user : null;
}
