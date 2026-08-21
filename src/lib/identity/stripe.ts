// StripeIdentityProvider — real KYC via Stripe Identity.
//
// Flow: startVerification() creates a hosted VerificationSession and returns
// its URL; we redirect the user to Stripe, which captures the ID document +
// selfie and runs the check. Stripe then calls our webhook, which invokes
// processResult() to read the verified outputs.
//
// We keep only what we're permitted to: verified legal name, document type, and
// the LAST 4 of the document number. Stripe retains the source images for
// compliance — customer service views them in the Stripe dashboard.
//
// Enable with IDENTITY_PROVIDER=stripe. Requires Stripe Identity turned on for
// the account and STRIPE_IDENTITY_WEBHOOK_SECRET set for the webhook.

import { stripe } from '@/lib/stripe';
import type { IdentityProvider, StartVerification, VerificationResult } from './index';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

// Restricted fields (document.number, verified_outputs.*) require expansion and
// aren't fully covered by the SDK types, so we read them through a narrow local
// shape rather than fighting the typings.
type Dob = { year?: number | null; month?: number | null; day?: number | null } | null;
type VerifiedOutputs = { first_name?: string | null; last_name?: string | null; dob?: Dob } | null;
type ReportDocument = {
  type?: string | null;
  number?: string | null;
  issuing_country?: string | null;
} | null;

function ageFromDob(dob: Dob): number | undefined {
  if (!dob?.year || !dob.month || !dob.day) return undefined;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.year;
  const hadBirthday =
    now.getUTCMonth() + 1 > dob.month ||
    (now.getUTCMonth() + 1 === dob.month && now.getUTCDate() >= dob.day);
  if (!hadBirthday) age -= 1;
  return age;
}

export class StripeIdentityProvider implements IdentityProvider {
  async startVerification(userId: string, baseUrl?: string): Promise<StartVerification> {
    // Prefer the request origin so the return URL always matches the domain the
    // user is actually on (localhost in dev, ten2ten.app in prod), independent
    // of the build-time NEXT_PUBLIC_APP_URL.
    const base = (baseUrl || APP_URL).replace(/\/+$/, '');
    const session = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: { user_id: userId },
      options: { document: { require_matching_selfie: true } },
      // Stripe returns the user here after the hosted flow; the webhook does the
      // actual write, so the page just re-reads status.
      return_url: `${base}/en/verify?return=1`,
    });
    return { vendorRef: session.id, redirectUrl: session.url ?? undefined };
  }

  async processResult(vendorRef: string): Promise<VerificationResult> {
    const session = await stripe.identity.verificationSessions.retrieve(vendorRef, {
      expand: ['verified_outputs', 'last_verification_report.document'],
    });

    if (session.status === 'processing') {
      return { status: 'pending', vendorRef };
    }
    if (session.status === 'requires_input') {
      // Recoverable prompt vs. hard failure: if there's an unresolved error the
      // user couldn't pass, treat it as failed; otherwise it's still pending.
      if (session.last_error) {
        return { status: 'failed', failureReason: session.last_error.code ?? 'requires_input', vendorRef };
      }
      return { status: 'pending', vendorRef };
    }
    if (session.status === 'canceled') {
      return { status: 'failed', failureReason: 'canceled', vendorRef };
    }

    // status === 'verified'
    const outputs = session.verified_outputs as unknown as VerifiedOutputs;
    const report = session.last_verification_report;
    const doc =
      report && typeof report !== 'string'
        ? ((report.document as unknown as ReportDocument) ?? null)
        : null;

    const fullName =
      `${outputs?.first_name ?? ''} ${outputs?.last_name ?? ''}`.trim() || undefined;
    const number = doc?.number ?? undefined;

    return {
      status: 'verified',
      vendorRef,
      fullName,
      age: ageFromDob(outputs?.dob ?? null),
      idType: doc?.type ?? undefined,
      idLast4: number ? number.slice(-4) : undefined,
      issuingCountry: doc?.issuing_country ?? undefined,
    };
  }
}
