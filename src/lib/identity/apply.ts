// Shared "write a verification result to the DB" logic, used by both the mock
// inline flow (identity/start) and the real webhook (identity/webhook) so the
// two can never drift.
//
// Writes the verified summary to the profile (name is locked by the
// lock_verified_full_name trigger once a bg-check exists) and closes out the
// matching identity_documents audit row. Enforces 18+ regardless of vendor.

import { createAdminClient } from '@/lib/supabase/server';
import type { VerificationResult } from './index';

type Admin = ReturnType<typeof createAdminClient>;

export async function applyVerificationResult(
  admin: Admin,
  userId: string,
  vendorRef: string,
  result: VerificationResult
): Promise<void> {
  const updates: Record<string, unknown> = { kyc_vendor_ref: vendorRef };
  let historyStatus: 'verified' | 'failed' | 'pending' = result.status;
  let failureReason: string | null = result.failureReason ?? null;

  if (result.status === 'verified') {
    if (result.age !== undefined && result.age < 18) {
      // Belt-and-suspenders: reject an under-18 even if the vendor passed them.
      updates.verification_status = 'failed';
      historyStatus = 'failed';
      failureReason = 'age_under_18';
    } else {
      updates.verification_status = 'verified';
      updates.identity_verified_at = new Date().toISOString();
      if (result.age !== undefined) updates.age = result.age;
      if (result.fullName) updates.full_name = result.fullName; // locked by trigger
      if (result.idType) updates.id_type = result.idType;
      if (result.idLast4) updates.id_last4 = result.idLast4;
    }
  } else if (result.status === 'failed') {
    updates.verification_status = 'failed';
  } else {
    updates.verification_status = 'pending';
  }

  const { error: profileErr } = await admin.from('profiles').update(updates).eq('id', userId);
  if (profileErr) throw profileErr;

  // Close out the audit row for this attempt (best-effort; don't fail the flow).
  await admin
    .from('identity_documents')
    .update({
      status: historyStatus,
      failure_reason: failureReason,
      doc_type: result.idType ?? null,
      id_last4: result.idLast4 ?? null,
    })
    .eq('user_id', userId)
    .eq('vendor_ref', vendorRef);
}
