import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export const CONTACT_BUNDLE_PRICE_CENTS = Number(
  process.env.CONTACT_BUNDLE_PRICE_CENTS ?? 10000
); // $100 => 3 contact credits

// Create a Checkout Session for a seeker buying a contact bundle.
// (Background screening has been removed; this is a plain contact-bundle purchase.)
export async function createContactCheckout(params: {
  seekerId: string;
  email: string;
  locale: 'en' | 'es';
  listingId?: string | null;
}): Promise<{ id: string; url: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: params.email,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: '3 contact credits' },
          unit_amount: CONTACT_BUNDLE_PRICE_CENTS,
        },
        quantity: 1,
      },
    ],
    locale: params.locale,
    // USD-only platform. Pin to card so Checkout can't surface location-based
    // methods; Apple Pay / Google Pay still ride on 'card'.
    payment_method_types: ['card'],
    // The webhook reads this to credit the right seeker.
    metadata: {
      seeker_id: params.seekerId,
      kind: 'contact_bundle',
      ...(params.listingId ? { listing_id: params.listingId } : {}),
    },
    success_url: `${appUrl}/${params.locale}/account?purchase=success`,
    cancel_url: `${appUrl}/${params.locale}/account?purchase=cancelled`,
  });

  return { id: session.id, url: session.url! };
}
