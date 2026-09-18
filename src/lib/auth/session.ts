// ============================================
// Bangladesh Business Tycoon - Session Signing
// ============================================
//
// The `playerId` cookie is the only credential in this game. Storing the raw
// player id in the cookie meant anyone who learned an id could impersonate that
// player — and the public leaderboard handed those ids out. The cookie value is
// now `<playerId>.<HMAC-SHA256(playerId)>` so a forged value is rejected.

import { createHash, createHmac, timingSafeEqual, randomBytes } from 'crypto';

export const SESSION_COOKIE = 'playerId';

/**
 * Cookie options for the session cookie.
 * `secure` is enabled outside development so the cookie is not sent over plain HTTP.
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 365,
  path: '/',
};

let cachedSecret: string | null = null;

/**
 * Resolve the signing secret.
 *
 * In production a real SESSION_SECRET is required — we refuse to fall back to a
 * generated one, because a per-process secret would silently invalidate every
 * session on restart and would differ between instances.
 */
function getSecret(): string {
  if (cachedSecret) return cachedSecret;

  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 32) {
    cachedSecret = fromEnv;
    return cachedSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SESSION_SECRET is missing or too short (needs >= 32 chars). Refusing to start with an insecure session secret.'
    );
  }

  // Development convenience only: ephemeral secret, logged loudly.
  cachedSecret = randomBytes(32).toString('hex');
  console.warn(
    '[auth] SESSION_SECRET not set — using a temporary development secret. ' +
      'Sessions will be invalidated on restart. Set SESSION_SECRET in .env.'
  );
  return cachedSecret;
}

function sign(playerId: string): string {
  return createHmac('sha256', getSecret()).update(playerId).digest('hex');
}

/** Build the signed cookie value for a player id. */
export function createSessionValue(playerId: string): string {
  return `${playerId}.${sign(playerId)}`;
}

/**
 * Verify a signed cookie value and return the player id, or null if the value is
 * missing, malformed, or the signature does not match.
 */
export function readSessionValue(value: string | undefined | null): string | null {
  if (!value) return null;

  const separator = value.lastIndexOf('.');
  if (separator <= 0) return null;

  const playerId = value.slice(0, separator);
  const providedSignature = value.slice(separator + 1);
  if (!playerId || !providedSignature) return null;

  const expected = Buffer.from(sign(playerId), 'utf8');
  const provided = Buffer.from(providedSignature, 'utf8');
  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;

  return playerId;
}

/**
 * Stable, non-reversible public identifier for a player.
 * Used where the UI needs a key (leaderboards) without exposing the real id,
 * which doubles as the session credential.
 */
export function publicPlayerRef(playerId: string): string {
  return createHmac('sha256', getSecret()).update(`public:${playerId}`).digest('hex').slice(0, 16);
}

// ============================================
// Account sessions (Google / email + password)
// ============================================
//
// The `playerId` cookie above predates accounts: it identified a guest save
// with no login behind it. Real accounts use `bt_session`, which carries a
// random 256-bit token. Only the SHA-256 of that token is stored in
// `AuthSession.id`, so the database never holds a usable credential, and a
// session can be revoked (sign-out) by deleting the row.

export const AUTH_COOKIE = 'bt_session';

/** How long a session stays valid without being used. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_MAX_AGE_SECONDS,
  path: '/',
};

/** Mint a fresh session token. The raw token goes in the cookie, the id in the DB. */
export function createSessionToken(): { token: string; id: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, id: sessionIdFromToken(token) };
}

/** Database key for a cookie token. Never store the token itself. */
export function sessionIdFromToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
