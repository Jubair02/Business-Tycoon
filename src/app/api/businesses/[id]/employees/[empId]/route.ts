import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; empId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get('playerId')?.value;

    if (!playerId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id, empId } = await params;

    // Validate business ownership
    const business = await db.business.findUnique({
      where: { id },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (business.playerId !== playerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Validate employee belongs to this business
    const employee = await db.employee.findUnique({
      where: { id: empId },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    if (employee.businessId !== id) {
      return NextResponse.json({ error: 'Employee does not belong to this business' }, { status: 400 });
    }

    await db.employee.delete({
      where: { id: empId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Fire employee error:', error);
    return NextResponse.json(
      { error: 'Failed to fire employee' },
      { status: 500 }
    );
  }
}
