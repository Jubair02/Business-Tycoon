import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { EMPLOYEE_ROLES, GAME_CONFIG, getRandomName } from '@/lib/game-data';

export async function POST(
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
    const body = await request.json();
    const { role } = body;

    if (!role) {
      return NextResponse.json(
        { error: 'Employee role is required' },
        { status: 400 }
      );
    }

    const roleDef = EMPLOYEE_ROLES.find((r) => r.role === role);
    if (!roleDef) {
      return NextResponse.json(
        { error: `Invalid role: ${role}` },
        { status: 400 }
      );
    }

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

    // Generate employee stats
    const name = getRandomName();
    const salaryVariation = 1 + Math.random() * 0.3;
    const salary = Math.round(roleDef.baseSalary * salaryVariation);
    const skill = Math.floor(Math.random() * 7) + 3; // 3-9
    const efficiency = 0.5 + skill * GAME_CONFIG.employeeEfficiencyPerSkill;

    const employee = await db.$transaction(async (tx) => {
      // Check max employees inside transaction to prevent race conditions
      const currentBusiness = await tx.business.findUnique({
        where: { id },
        include: { employees: true },
      });

      if (!currentBusiness) {
        throw new Error('Business not found');
      }

      if (currentBusiness.employees.length >= GAME_CONFIG.maxEmployees) {
        throw new Error(`Maximum ${GAME_CONFIG.maxEmployees} employees per business`);
      }

      return tx.employee.create({
        data: {
          businessId: id,
          role,
          name,
          salary,
          skill,
          efficiency: Math.round(efficiency * 100) / 100,
        },
      });
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Business not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.startsWith('Maximum')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    console.error('Hire employee error:', error);
    return NextResponse.json(
      { error: 'Failed to hire employee' },
      { status: 500 }
    );
  }
}
