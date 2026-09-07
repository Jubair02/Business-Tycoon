import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlayerId, notFound, forbidden, validationError, handleApiError } from '@/lib/errors';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; empId: string }> }
) {
  try {
    const playerId = await requirePlayerId();

    const { id, empId } = await params;

    // Validate business ownership
    const business = await db.business.findUnique({
      where: { id },
    });

    if (!business) {
      throw notFound('Business');
    }

    if (business.playerId !== playerId) {
      throw forbidden();
    }

    // Validate employee belongs to this business
    const employee = await db.employee.findUnique({
      where: { id: empId },
    });

    if (!employee) {
      throw notFound('Employee');
    }

    if (employee.businessId !== id) {
      throw validationError('Employee does not belong to this business');
    }

    await db.employee.delete({
      where: { id: empId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
