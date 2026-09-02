import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get('playerId')?.value;

    if (!playerId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;

    const business = await db.business.findUnique({
      where: { id },
      include: {
        inventories: {
          orderBy: { createdAt: 'desc' },
        },
        employees: {
          orderBy: { hiredAt: 'asc' },
        },
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (business.playerId !== playerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json(business);
  } catch (error) {
    console.error('Get business error:', error);
    return NextResponse.json(
      { error: 'Failed to get business' },
      { status: 500 }
    );
  }
}
