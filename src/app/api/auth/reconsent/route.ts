import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { CURRENT_CONSENT_VERSION } from '@/lib/consent';

// A signed-in member re-accepts the updated legal documents. We record the current
// consent version + timestamp on their account (user_metadata), which clears the
// middleware re-consent gate on their next request. Both the combined
// (terms/privacy/identity) consent and the separate 152-ФЗ personal-data consent
// must be affirmed, mirroring the signup form.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { consent?: unknown; pdConsent?: unknown };
  if (body.consent !== true || body.pdConsent !== true) {
    return NextResponse.json({ error: 'consent_required' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(user.user_metadata ?? {}),
      consent_version: CURRENT_CONSENT_VERSION,
      consented_at: new Date().toISOString(),
    },
  });
  if (error) {
    console.error('[auth/reconsent] update failed', error);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
