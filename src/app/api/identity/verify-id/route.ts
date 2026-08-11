import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Self-hosted ID upload path (mock auto-verify). NOTE: the primary flow is now
// Stripe Identity (see /api/identity/start), where the provider holds the source
// images. This route remains for the self-hosted-upload option: the client
// uploads a government-ID photo to the private id-documents bucket under
// <uid>/id-<timestamp>.<ext> (unique per upload, never overwritten) and calls
// this with the path. We record an append-only audit row and mark the profile
// verified so customer service can retrieve every upload later.
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
  const vendorRef = `mock_id_upload_${Date.now()}`;
  const { error } = await admin
    .from('profiles')
    .update({
      verification_status: 'verified',
      identity_verified_at: new Date().toISOString(),
      id_document_path: path,
      kyc_vendor_ref: vendorRef,
    })
    .eq('id', user.id);
  if (error) {
    console.error('[verify-id] profile update failed', error);
    return NextResponse.json({ error: 'verify_failed' }, { status: 500 });
  }

  // Append-only audit row so every uploaded document is retained and queryable
  // by customer service (nothing is ever overwritten).
  await admin.from('identity_documents').insert({
    user_id: user.id,
    kind: 'upload',
    storage_path: path,
    vendor_ref: vendorRef,
    status: 'verified',
  });

  return NextResponse.json({ status: 'verified' });
}
