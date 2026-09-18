import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { loginSchema, unauthorized, handleApiError } from '@/lib/errors';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSession, attachSessionCookie } from '@/lib/auth/user-session';
import { ensurePlayerForUser, getAccountProfile } from '@/lib/auth/account';
import { enforceRateLimit } from '@/lib/rate-limit';

/**
 * A throwaway hash, verified against when the email is unknown.
 *
 * Without it, a missing account would answer far faster than a wrong password
 * and the response time alone would reveal which emails are registered.
 */
let decoyHash: Promise<string> | null = null;
function getDecoyHash(): Promise<string> {
  decoyHash ??= hashPassword(randomBytes(24).toString('hex'));
  return decoyHash;
}

export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(request, 'auth:login', { limit: 20, windowMs: 15 * 60 * 1000 });

    const body = loginSchema.parse(await request.json());

    const user = await db.user.findUnique({
      where: { email: body.email },
      select: { id: true, email: true, name: true, image: true, passwordHash: true },
    });

    const passwordOk = await verifyPassword(
      body.password,
      user?.passwordHash ?? (await getDecoyHash())
    );

    // One message for both "no such account" and "wrong password": the form
    // should not double as a way to enumerate registered emails.
    if (!user || !user.passwordHash || !passwordOk) {
      throw unauthorized('Incorrect email or password.');
    }

    const { claimedGuestSave } = await ensurePlayerForUser(user);
    const token = await createSession(user.id, request.headers.get('user-agent'));
    const profile = await getAccountProfile(user.id);

    return attachSessionCookie(NextResponse.json({ ...profile, claimedGuestSave }), token);
  } catch (error) {
    return handleApiError(error);
  }
}
