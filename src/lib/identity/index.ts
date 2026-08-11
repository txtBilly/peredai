// IdentityProvider interface + factory
// To swap in a real provider (e.g. Stripe Identity), set:
//   IDENTITY_PROVIDER=stripe   in .env.local
// and implement StripeIdentityProvider in ./stripe.ts.
// Default is 'mock' — simulates success/failure in dev via query params.

export type VerificationResult = {
  // 'pending' = provider is still processing (real vendors are async).
  status: 'verified' | 'failed' | 'pending';
  age?: number;           // derived from DOB; never store full DOB
  vendorRef?: string;     // provider inquiry/session id
  failureReason?: string;
  // Verified outputs we're permitted to keep (document number is truncated to
  // last 4 by the provider adapter — the full number is never returned here).
  fullName?: string;      // verified legal name (locked on the profile)
  idType?: string;        // passport | driving_license | id_card
  idLast4?: string;       // last 4 of the document number only
  issuingCountry?: string;
};

export type StartVerification = {
  vendorRef: string;
  /** Hosted-flow URL to redirect the user to (real providers). Absent for mock. */
  redirectUrl?: string;
};

export interface IdentityProvider {
  /** Kick off verification for a user. Returns a vendor ref (+ redirect URL). */
  startVerification(userId: string): Promise<StartVerification>;

  /** Process a completed verification (called from webhook or mock callback). */
  processResult(vendorRef: string): Promise<VerificationResult>;
}

// Factory — reads IDENTITY_PROVIDER env var; defaults to mock.
export async function getIdentityProvider(): Promise<IdentityProvider> {
  const provider = process.env.IDENTITY_PROVIDER ?? 'mock';
  if (provider === 'mock') {
    const { MockIdentityProvider } = await import('./mock');
    return new MockIdentityProvider();
  }
  if (provider === 'stripe') {
    const { StripeIdentityProvider } = await import('./stripe');
    return new StripeIdentityProvider();
  }
  throw new Error(`Unknown IDENTITY_PROVIDER: ${provider}`);
}
