import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signupSchema, conflict, handleApiError } from '@/lib/errors';
import { hashPassword } from '@/lib/auth/password';
import { createSession, attachSessionCookie } from '@/lib/auth/user-session';
import { ensurePlayerForUser, getAccountProfile } from '@/lib/auth/account';
import { enforceRateLimit } from '@/lib/rate-limit';

/**
 * Create an account with an email and password, and start a session.
 *
 * Any guest progress in this browser is adopted by the new account, so someone
 * who played before signing up keeps their empire.
 */
export async function POST(request: NextRequest) {
  try {
    // Creating accounts writes permanent rows, so throttle it per client.
    enforceRateLimit(request, 'auth:register', { limit: 10, windowMs: 60 * 60 * 1000 });

    const body = signupSchema.parse(await request.json());

    const existing = await db.user.findUnique({
      where: { email: body.email },
      select: { id: true, passwordHash: true },
    });

    if (existing) {
      // Never attach a password to someone else's Google account from an
      // unverified sign-up form — that would be account takeover.
      throw conflict(
        existing.passwordHash
          ? 'An account with this email already exists. Sign in instead.'
          : 'This email is already used by a Google sign-in. Continue with Google.'
      );
    }

    const user = await db.user.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash: await hashPassword(body.password),
      },
      select: { id: true, email: true, name: true, image: true },
    });

    const { claimedGuestSave } = await ensurePlayerForUser(user);
    const token = await createSession(user.id, request.headers.get('user-agent'));
    const profile = await getAccountProfile(user.id);

    return attachSessionCookie(
      NextResponse.json({ ...profile, claimedGuestSave }, { status: 201 }),
      token
    );
  } catch (error) {
    return handleApiError(error);
  }
}
