import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { locales, defaultLocale } from '@/i18n/config';
import { CURRENT_CONSENT_VERSION } from '@/lib/consent';

// Routes that require authentication
const PROTECTED = ['/account', '/verify', '/list'];
// Routes that redirect authenticated users away
const AUTH_ONLY = ['/signin', '/signup', '/reset'];

function pickLocale(_req: NextRequest): string {
  // Russian-market default: always land on the default locale (ru), regardless of
  // the browser's Accept-Language. Visitors can still switch to English via the
  // header toggle (/en/...).
  return defaultLocale;
}

function stripLocale(pathname: string): string {
  for (const l of locales) {
    if (pathname === `/${l}`) return '/';
    if (pathname.startsWith(`/${l}/`)) return pathname.slice(l.length + 1);
  }
  return pathname;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/admin') || // non-localized staff area (gated in its layout)
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Ensure locale prefix
  const hasLocale = (locales as readonly string[]).some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)
  );
  if (!hasLocale) {
    const locale = pickLocale(req);
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url);
  }

  const locale =
    (locales as readonly string[]).find(
      (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)
    ) ?? defaultLocale;
  const bare = stripLocale(pathname);

  // Pre-launch passcode gate — active ONLY when SITE_PASSCODE is set. Until
  // then this whole block is skipped, so normal dev is unaffected. A visitor
  // without the unlock cookie is sent to the /gate splash; the gate page itself
  // is always reachable so they can enter the code.
  const passcode = process.env.SITE_PASSCODE;
  if (passcode) {
    const isGate = bare === '/gate';
    const unlocked = req.cookies.get('t2t_gate')?.value === (await gateToken(passcode));
    if (!unlocked && !isGate) {
      const url = req.nextUrl.clone();
      url.pathname = `/${locale}/gate`;
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    if (unlocked && isGate) {
      const url = req.nextUrl.clone();
      url.pathname = `/${locale}`;
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  const isProtected = PROTECTED.some((p) => bare === p || bare.startsWith(p + '/'));
  const isAuthOnly = AUTH_ONLY.some((p) => bare === p || bare.startsWith(p + '/'));

  // Pages a logged-in-but-unverified user is still allowed to reach. Everything
  // else redirects them into the mandatory Sber/T-ID step. `/verify` MUST be here
  // or the gate would loop.
  const VERIFY_EXEMPT = ['/gate', '/signin', '/signup', '/reset', '/verify', '/banned'];
  const isVerifyExempt = VERIFY_EXEMPT.some((p) => bare === p || bare.startsWith(p + '/'));

  // Pages a signed-in member with an outdated consent version may still reach
  // without being bounced to the re-consent prompt: the prompt itself, the auth
  // screens, and the legal documents (so they can actually read what changed).
  const RECONSENT_EXEMPT = [
    ...VERIFY_EXEMPT,
    '/reconsent',
    '/privacy',
    '/terms',
    '/personal-data-consent',
    '/identity-consent',
  ];
  const isReconsentExempt = RECONSENT_EXEMPT.some((p) => bare === p || bare.startsWith(p + '/'));

  // A Supabase auth cookie signals a possible session — used to decide whether the
  // mandatory-verify gate needs to run (so anonymous visitors skip the getUser call).
  const hasSessionCookie = req.cookies.getAll().some((c) => c.name.includes('auth-token'));

  // Hit Supabase only when we need to check auth: protected/auth-only routes, or a
  // logged-in user on a non-exempt route (to enforce the verification gate).
  if (!isProtected && !isAuthOnly && !(hasSessionCookie && !isVerifyExempt)) {
    return NextResponse.next();
  }

  // If Supabase isn't configured (e.g. no .env.local yet), treat as unauthenticated.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('YOUR_PROJECT')) {
    if (isProtected) {
      const url = req.nextUrl.clone();
      url.pathname = `/${locale}/signin`;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request: req });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(toSet: { name: string; value: string; options: CookieOptions }[]) {
        toSet.forEach(({ name, value }) => req.cookies.set(name, value));
        response = NextResponse.next({ request: req });
        toSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Verified check. Fast path: the app_metadata.verified claim on the session.
  // If it's absent/stale (the JWT was minted before verification and hasn't
  // refreshed yet), confirm against the DB profile before trapping the user —
  // otherwise a member who JUST verified is held on /verify with every link
  // bouncing back. Read errors fail open (don't trap on a transient hiccup).
  let verified = !!(user?.app_metadata as { verified?: boolean } | undefined)?.verified;
  if (user && !verified) {
    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('verification_status')
      .eq('id', user.id)
      .maybeSingle();
    verified = profErr ? true : prof?.verification_status === 'verified';
  }

  if (isProtected && !user) {
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/signin`;
    return NextResponse.redirect(url);
  }

  // Logged-in users don't belong on the sign-in / sign-up screens: send verified
  // members to their account, and anyone mid-onboarding to the verify step.
  if (isAuthOnly && user) {
    const url = req.nextUrl.clone();
    url.pathname = verified ? `/${locale}/account` : `/${locale}/verify`;
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Mandatory verification: a signed-in but unverified member is held at /verify
  // until they complete Sber ID / T-ID. (Exempt paths handled above.)
  if (user && !verified && !isVerifyExempt) {
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/verify`;
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Re-consent gate: when the legal documents have been updated, a verified member
  // whose stored consent_version is stale is routed to /reconsent to accept the new
  // revision before continuing. Fresh signups already carry the current version, so
  // this only catches accounts created against an earlier revision.
  if (user && verified && !isReconsentExempt) {
    const consentVersion = (user.user_metadata as { consent_version?: string } | undefined)?.consent_version;
    if (consentVersion !== CURRENT_CONSENT_VERSION) {
      const url = req.nextUrl.clone();
      url.pathname = `/${locale}/reconsent`;
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
  }

  return response;
}

// Deterministic unlock token for the passcode gate. The cookie stores this hash
// (not the raw code); middleware (edge) and /api/gate (node) compute it the same
// way so they agree. This is a soft pre-launch gate, not a security boundary.
async function gateToken(passcode: string): Promise<string> {
  const data = new TextEncoder().encode(`ten2ten-gate:${passcode}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const config = {
  matcher: ['/', '/((?!_next|api|.*\\..*).*)'],
};
