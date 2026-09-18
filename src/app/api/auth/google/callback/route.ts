import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  OAUTH_COOKIE_OPTIONS,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  fetchGoogleProfile,
  getBaseUrl,
  googleRedirectUri,
  isGoogleConfigured,
  statesMatch,
  type GoogleProfile,
} from '@/lib/auth/google';
import { createSession, attachSessionCookie } from '@/lib/auth/user-session';
import { ensurePlayerForUser } from '@/lib/auth/account';
import { ROUTES } from '@/lib/game-routes';

const PROVIDER = 'google';

/** Send the player back to the welcome screen with a code the UI can explain. */
function fail(baseUrl: string, reason: string): NextResponse {
  return clearOAuthCookies(NextResponse.redirect(new URL(`/?auth_error=${reason}`, baseUrl)));
}

function clearOAuthCookies(response: NextResponse): NextResponse {
  response.cookies.set(OAUTH_STATE_COOKIE, '', { ...OAUTH_COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set(OAUTH_VERIFIER_COOKIE, '', { ...OAUTH_COOKIE_OPTIONS, maxAge: 0 });
  return response;
}

/**
 * Resolve a Google profile to a user account.
 *
 * Three cases, in order: this Google account is already linked; the email
 * belongs to an existing account (link the two — Google has verified the
 * address, so this is the same person); or it is somebody new.
 */
async function findOrCreateUser(profile: GoogleProfile) {
  const linked = await db.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider: PROVIDER, providerAccountId: profile.sub } },
    select: { user: { select: { id: true, email: true, name: true, image: true } } },
  });

  if (linked) {
    // Refresh the profile picture, which Google rotates on its own URLs.
    if (profile.picture && profile.picture !== linked.user.image) {
      await db.user.update({ where: { id: linked.user.id }, data: { image: profile.picture } });
      return { ...linked.user, image: profile.picture };
    }
    return linked.user;
  }

  const byEmail = await db.user.findUnique({
    where: { email: profile.email },
    select: { id: true, email: true, name: true, image: true },
  });

  if (byEmail) {
    await db.oAuthAccount.create({
      data: { userId: byEmail.id, provider: PROVIDER, providerAccountId: profile.sub },
    });
    await db.user.update({
      where: { id: byEmail.id },
      data: { emailVerified: true, image: byEmail.image ?? profile.picture },
    });
    return { ...byEmail, image: byEmail.image ?? profile.picture };
  }

  return db.user.create({
    data: {
      email: profile.email,
      name: profile.name,
      image: profile.picture,
      emailVerified: true,
      accounts: { create: { provider: PROVIDER, providerAccountId: profile.sub } },
    },
    select: { id: true, email: true, name: true, image: true },
  });
}

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request);

  if (!isGoogleConfigured()) {
    return fail(baseUrl, 'google_unavailable');
  }

  const params = request.nextUrl.searchParams;

  // The player cancelled on Google's consent screen.
  if (params.get('error')) {
    return fail(baseUrl, 'google_cancelled');
  }

  const code = params.get('code');
  const state = params.get('state') ?? undefined;
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const verifier = request.cookies.get(OAUTH_VERIFIER_COOKIE)?.value;

  if (!code || !verifier || !statesMatch(state, expectedState)) {
    // A mismatched or missing state means this callback did not come from a
    // sign-in this browser started.
    return fail(baseUrl, 'google_state');
  }

  try {
    const profile = await fetchGoogleProfile(code, googleRedirectUri(request), verifier);

    if (!profile.emailVerified) {
      return fail(baseUrl, 'google_unverified');
    }

    const user = await findOrCreateUser(profile);
    const { claimedGuestSave } = await ensurePlayerForUser(user);
    const token = await createSession(user.id, request.headers.get('user-agent'));

    const destination = new URL(ROUTES.dashboard, baseUrl);
    if (claimedGuestSave) {
      destination.searchParams.set('claimed', '1');
    }

    return clearOAuthCookies(attachSessionCookie(NextResponse.redirect(destination), token));
  } catch (error) {
    console.error('[auth] Google callback failed:', error);
    return fail(baseUrl, 'google_failed');
  }
}
