// ============================================
// Bangladesh Business Tycoon - Google Sign-In
// ============================================
//
// Plain OAuth 2.0 authorization-code flow with PKCE, no SDK. Two short-lived
// cookies carry the CSRF `state` and the PKCE verifier across the round trip to
// Google; both are cleared by the callback.

import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const VALID_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export const OAUTH_STATE_COOKIE = 'bt_oauth_state';
export const OAUTH_VERIFIER_COOKIE = 'bt_oauth_verifier';

/** Options for the two cookies that only need to survive the redirect to Google. */
export const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 10,
  path: '/',
};

/** Google sign-in is optional: without credentials the button is simply hidden. */
export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function requireCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not configured');
  }
  return { clientId, clientSecret };
}

/**
 * Public origin of this deployment.
 *
 * `APP_URL` wins when set — behind the Caddy proxy the request the app sees is
 * plain HTTP on an internal host, which would produce a redirect URI Google
 * rejects. The forwarded headers are the fallback.
 */
export function getBaseUrl(request: NextRequest): string {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, '');

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (host) {
    const proto =
      request.headers.get('x-forwarded-proto') ||
      (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

export function googleRedirectUri(request: NextRequest): string {
  return `${getBaseUrl(request)}/api/auth/google/callback`;
}

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export function createPkcePair(): PkcePair {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function createState(): string {
  return randomBytes(16).toString('base64url');
}

/** Constant-time comparison for the `state` round trip. */
export function statesMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Build the URL the player is sent to in order to pick a Google account. */
export function buildAuthorizationUrl(options: {
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const { clientId } = requireCredentials();
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', options.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', options.state);
  url.searchParams.set('code_challenge', options.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  // `select_account` so a shared browser does not silently sign the previous
  // player back in.
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
}

/**
 * Exchange an authorization code for the player's Google profile.
 *
 * The id_token arrives over a direct server-to-server TLS call to Google's
 * token endpoint, so its claims are decoded rather than signature-verified —
 * the transport is the trust anchor. Issuer, audience and expiry are still
 * checked to catch a token meant for someone else.
 */
export async function fetchGoogleProfile(code: string, redirectUri: string, codeVerifier: string): Promise<GoogleProfile> {
  const { clientId, clientSecret } = requireCredentials();

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Google token exchange failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const payload = (await response.json()) as { id_token?: string };
  if (!payload.id_token) {
    throw new Error('Google token response did not include an id_token');
  }

  const claims = decodeIdToken(payload.id_token);

  if (!VALID_ISSUERS.includes(claims.iss)) {
    throw new Error(`Unexpected id_token issuer: ${claims.iss}`);
  }
  if (claims.aud !== clientId) {
    throw new Error('id_token was issued for a different client');
  }
  if (typeof claims.exp === 'number' && claims.exp * 1000 <= Date.now()) {
    throw new Error('id_token has expired');
  }
  if (!claims.email) {
    throw new Error('Google account did not return an email address');
  }

  return {
    sub: claims.sub,
    email: claims.email.toLowerCase(),
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    name: claims.name || claims.given_name || claims.email.split('@')[0],
    picture: claims.picture ?? null,
  };
}

interface IdTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  exp?: number;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  given_name?: string;
  picture?: string;
}

function decodeIdToken(idToken: string): IdTokenClaims {
  const segments = idToken.split('.');
  if (segments.length !== 3) {
    throw new Error('Malformed id_token');
  }

  const json = Buffer.from(segments[1], 'base64url').toString('utf8');
  const claims = JSON.parse(json) as IdTokenClaims;

  if (!claims.sub || !claims.iss) {
    throw new Error('id_token is missing required claims');
  }

  return claims;
}
