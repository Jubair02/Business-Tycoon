import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export async function GET() {
  try {
    const events = await db.gameEvent.findMany({
      where: { active: true },
      orderBy: { startsAt: 'desc' },
    });

    return NextResponse.json(events);
  } catch (error) {
    return handleApiError(error);
  }
}
