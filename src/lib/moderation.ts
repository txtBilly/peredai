import { createAdminClient } from './supabase/server';
import { refundCreditForReport } from './credits';

// Report review consequences (Session 5). All service-role and idempotent; the
// UI that triggers these lands in Session 6. Confirming a report:
//   - marks it confirmed;
//   - if a seeker reported the lister in a chat → refunds the seeker's credit
//     (once) and closes that chat as reported, freeing the listing;
//   - records a strike (1st = 7-day suspension via reactivates_at);
//   - on a 2nd confirmed report from a *different* reporter → shadow-bans the
//     member and suspends the offending listing.
// Per product decision, a shadow-banned member's OTHER active chats are NOT
// auto-closed here — that's a manual support decision.

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function confirmReport(
  reportId: string,
  reviewerId: string | null
): Promise<{ ok: true } | { error: string }> {
  const admin = createAdminClient();

  const { data: report } = await admin.from('reports').select('*').eq('id', reportId).maybeSingle();
  if (!report) return { error: 'report_not_found' };
  if (report.status !== 'open') return { ok: true }; // idempotent — already resolved

  await admin
    .from('reports')
    .update({ status: 'confirmed', reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq('id', reportId);

  // Refund path: a seeker who reported the lister of their chat gets the credit
  // back, and that chat closes as reported.
  if (report.chat_id) {
    const { data: chat } = await admin
      .from('chats')
      .select('id, seeker_id, lister_id, listing_id, status')
      .eq('id', report.chat_id)
      .maybeSingle();
    if (chat && report.reporter_id === chat.seeker_id && report.reported_user === chat.lister_id) {
      if (!report.refund_issued) {
        await refundCreditForReport({ seekerId: chat.seeker_id, chatId: chat.id });
        await admin.from('reports').update({ refund_issued: true }).eq('id', reportId);
      }
      if (chat.status === 'active') {
        await admin
          .from('chats')
          .update({ status: 'closed_reported', closed_at: new Date().toISOString(), closed_reason: 'reported' })
          .eq('id', chat.id);
        await admin.from('listings').update({ status: 'active' }).eq('id', chat.listing_id);
      }
    }
  }

  const reportedUser = report.reported_user as string | null;
  if (reportedUser) {
    // Strike (number = prior strikes + 1). First strike → 7-day suspension.
    const { count: prior } = await admin
      .from('strikes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', reportedUser);
    await admin.from('strikes').insert({
      user_id: reportedUser,
      listing_id: report.listing_id,
      report_id: reportId,
      number: (prior ?? 0) + 1,
      status: 'active',
      reactivates_at: new Date(Date.now() + SEVEN_DAYS_MS).toISOString(),
    });

    // Shadow-ban on 2+ confirmed reports from *different* reporters.
    const { data: confirmed } = await admin
      .from('reports')
      .select('reporter_id')
      .eq('reported_user', reportedUser)
      .eq('status', 'confirmed');
    const distinctReporters = new Set((confirmed ?? []).map((r) => r.reporter_id));
    if (distinctReporters.size >= 2) {
      await admin.from('profiles').update({ is_shadow_banned: true }).eq('id', reportedUser);
      if (report.listing_id) {
        await admin.from('listings').update({ status: 'suspended' }).eq('id', report.listing_id);
      }
    }
  }

  return { ok: true };
}

export async function dismissReport(
  reportId: string,
  reviewerId: string | null
): Promise<{ ok: true } | { error: string }> {
  const admin = createAdminClient();
  const { data: report } = await admin.from('reports').select('status').eq('id', reportId).maybeSingle();
  if (!report) return { error: 'report_not_found' };
  if (report.status !== 'open') return { ok: true };
  await admin
    .from('reports')
    .update({ status: 'dismissed', reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq('id', reportId);
  return { ok: true };
}
