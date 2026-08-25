// Shared "write a verification result to the DB" logic, used by both the mock
// inline flow (identity/start) and the real OAuth callback (identity/callback)
// so the two can never drift.
//
// Also enforces the anti-abuse identity binding: one real verified identity
// (provider `sub`, hashed into `identityKey`) maps to exactly one account, and a
// banned identity can never re-verify. When those checks fail, verification is
// recorded as failed instead of verified.

import { createAdminClient } from '@/lib/supabase/server';
import type { VerificationResult } from './index';

type Admin = ReturnType<typeof createAdminClient>;

export async function applyVerificationResult(
  admin: Admin,
  userId: string,
  vendorRef: string,
  result: VerificationResult,
  identityKey?: string
): Promise<void> {
  const updates: Record<string, unknown> = { kyc_vendor_ref: vendorRef };
  let historyStatus: 'verified' | 'failed' | 'pending' = result.status;
  let failureReason: string | null = result.failureReason ?? null;

  if (result.status === 'verified') {
    // 18+ gate — only enforced when the provider actually returns an age.
    if (result.age !== undefined && result.age < 18) {
      updates.verification_status = 'failed';
      historyStatus = 'failed';
      failureReason = 'age_under_18';
    } else {
      // Anti-abuse identity binding (bank providers return a stable `sub`).
      let identityOk = true;
      if (identityKey) {
        const { data: banned } = await admin
          .from('banned_identities')
          .select('identity_key')
          .eq('identity_key', identityKey)
          .maybeSingle();
        if (banned) {
          identityOk = false;
          failureReason = 'identity_banned';
        } else {
          const { data: other } = await admin
            .from('profiles')
            .select('id')
            .eq('verified_identity_key', identityKey)
            .neq('id', userId)
            .maybeSingle();
          if (other) {
            identityOk = false;
            failureReason = 'identity_in_use';
          }
        }
      }

      if (!identityOk) {
        updates.verification_status = 'failed';
        historyStatus = 'failed';
      } else {
        updates.verification_status = 'verified';
        updates.identity_verified_at = new Date().toISOString();
        if (identityKey) updates.verified_identity_key = identityKey;
        if (result.age !== undefined) updates.age = result.age;
        if (result.fullName) updates.full_name = result.fullName; // locked by trigger
        if (result.idType) updates.id_type = result.idType;
        if (result.idLast4) updates.id_last4 = result.idLast4;
      }
    }
  } else if (result.status === 'failed') {
    updates.verification_status = 'failed';
  } else {
    updates.verification_status = 'pending';
  }

  const { error: profileErr } = await admin.from('profiles').update(updates).eq('id', userId);
  if (profileErr) throw profileErr;

  // Mirror verified status into the auth user's app_metadata so middleware can
  // enforce the "must verify before using the app" gate by reading the session
  // JWT, with no per-request DB lookup. Best-effort — the DB profile is the
  // source of truth.
  if (updates.verification_status === 'verified') {
    try {
      await admin.auth.admin.updateUserById(userId, { app_metadata: { verified: true } });
    } catch (e) {
      console.error('[identity] app_metadata verified update failed', e);
    }
  }

  // Close out the audit row for this attempt (best-effort).
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
