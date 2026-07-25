import { getUser } from './auth';
import { createClient } from './supabase/server';

// Returns the signed-in user iff they are staff, else null. Use in every
// /api/admin route (server-side authorization — never trust the client).
export async function requireStaff() {
  const user = await getUser();
  if (!user) return null;
  const supabase = createClient();
  const { data } = await supabase.from('profiles').select('is_staff').eq('id', user.id).maybeSingle();
  return data?.is_staff ? user : null;
}
