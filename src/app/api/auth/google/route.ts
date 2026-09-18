import { NextRequest, NextResponse } from 'next/server';
import {
  OAUTH_COOKIE_OPTIONS,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  buildAuthorizationUrl,
  createPkcePair,
  createState,
  getBaseUrl,
  googleRedirectUri,
  isGoogleConfigured,
} from '@/lib/auth/google';
import { enforceRateLimit } from '@/lib/rate-limit';

/**
 * Start Google sign-in.
 *
 * The CSRF `state` and the PKCE verifier are handed to the browser as
 * short-lived httpOnly cookies; the callback is only willing to complete a sign
 * in that can produce both.
 */
export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request);

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL('/?auth_error=google_unavailable', baseUrl));
  }

  try {
    enforceRateLimit(request, 'auth:google', { limit: 30, windowMs: 15 * 60 * 1000 });
  } catch {
    return NextResponse.redirect(new URL('/?auth_error=rate_limited', baseUrl));
  }

  const state = createState();
  const { verifier, challenge } = createPkcePair();

  const response = NextResponse.redirect(
    buildAuthorizationUrl({
      redirectUri: googleRedirectUri(request),
      state,
      codeChallenge: challenge,
    })
  );

  response.cookies.set(OAUTH_STATE_COOKIE, state, OAUTH_COOKIE_OPTIONS);
  response.cookies.set(OAUTH_VERIFIER_COOKIE, verifier, OAUTH_COOKIE_OPTIONS);
  return response;
}
