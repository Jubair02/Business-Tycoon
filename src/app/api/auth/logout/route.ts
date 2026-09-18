import { NextResponse } from 'next/server';
import { destroyCurrentSession, clearSessionCookie } from '@/lib/auth/user-session';
import { handleApiError } from '@/lib/errors';

/** Sign out: revoke the session server-side, then expire the cookie. */
export async function POST() {
  try {
    await destroyCurrentSession();
    return clearSessionCookie(NextResponse.json({ success: true }));
  } catch (error) {
    return handleApiError(error);
  }
}
