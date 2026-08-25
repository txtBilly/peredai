import { createClient, createAdminClient } from '@/lib/supabase/server';

// Mint a Supabase session for an EXISTING account, server-side, after an external
// identity (Sber ID / T-ID / mock) has been verified for that account. We ask the
// admin API to generate a one-time magic-link token and immediately redeem it on
// the cookie-bound SSR client — establishing the session cookies WITHOUT sending
// any email (so this never waits on the email provider).
//
// SECURITY: this logs a browser into `email` with no further checks. Only ever
// call it after a genuinely-completed bank auth that resolves to this account
// (login: matched by verified_identity_key; signup: right after we created the
// account from the user's own email). Never call it on unauthenticated input.
export async function mintSessionForEmail(
  email: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data?.properties) {
    return { ok: false, error: error?.message ?? 'generate_link_failed' };
  }

  const supabase = createClient(); // cookie-bound — verifyOtp sets the session cookies
  const hashedToken = data.properties.hashed_token;
  const emailOtp = data.properties.email_otp;

  // The verify "type" that pairs with an admin-generated magic link differs
  // slightly across Supabase versions, so try the token_hash path first and fall
  // back to the 6-digit OTP path.
  if (hashedToken) {
    const { error: e1 } = await supabase.auth.verifyOtp({ token_hash: hashedToken, type: 'magiclink' });
    if (!e1) return { ok: true };
  }
  if (emailOtp) {
    const { error: e2 } = await supabase.auth.verifyOtp({ email, token: emailOtp, type: 'email' });
    if (!e2) return { ok: true };
  }
  return { ok: false, error: 'session_mint_failed' };
}
