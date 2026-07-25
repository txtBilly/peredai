import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Lister ID verification (mock auto-verify). The client uploads a government-ID
// photo to the private id-documents bucket under <uid>/…, then calls this with
// the path. We record it and mark the profile verified. A real KYC vendor would
// replace the auto-verify with an async check + webhook.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const path = (body as { path?: unknown })?.path;
  // The path must live under the caller's own folder.
  if (typeof path !== 'string' || !path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'invalid_path' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({
      verification_status: 'verified',
      id_document_path: path,
      kyc_vendor_ref: 'mock_id_upload',
    })
    .eq('id', user.id);
  if (error) {
    console.error('[verify-id] profile update failed', error);
    return NextResponse.json({ error: 'verify_failed' }, { status: 500 });
  }

  return NextResponse.json({ status: 'verified' });
}
