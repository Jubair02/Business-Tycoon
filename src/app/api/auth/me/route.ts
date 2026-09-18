import { NextResponse } from 'next/server';
import { resolveSession } from '@/lib/auth/user-session';
import { getAccountProfile } from '@/lib/auth/account';
import { handleApiError } from '@/lib/errors';

/**
 * The signed-in account and the save attached to it.
 *
 * Answers 200 with `{ user: null }` rather than 401 when nobody is signed in —
 * this is the "who am I?" probe, not a guarded resource.
 */
export async function GET() {
  try {
    const session = await resolveSession();
    if (!session) {
      return NextResponse.json({ user: null, player: null });
    }

    const profile = await getAccountProfile(session.userId);
    return NextResponse.json(profile ?? { user: null, player: null });
  } catch (error) {
    return handleApiError(error);
  }
}
