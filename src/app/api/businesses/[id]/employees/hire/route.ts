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
      include: { employees: true },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (business.playerId !== playerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check max employees
    if (business.employees.length >= GAME_CONFIG.maxEmployees) {
      return NextResponse.json(
        { error: `Maximum ${GAME_CONFIG.maxEmployees} employees per business` },
        { status: 400 }
      );
    }

    // Generate employee stats
    const name = getRandomName();
    const salaryVariation = 1 + Math.random() * 0.3;
    const salary = Math.round(roleDef.baseSalary * salaryVariation);
    const skill = Math.floor(Math.random() * 7) + 3; // 3-9
    const efficiency = 0.5 + skill * GAME_CONFIG.employeeEfficiencyPerSkill;

    const employee = await db.employee.create({
      data: {
        businessId: id,
        role,
        name,
        salary,
        skill,
        efficiency: Math.round(efficiency * 100) / 100,
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error('Hire employee error:', error);
    return NextResponse.json(
      { error: 'Failed to hire employee' },
      { status: 500 }
    );
  }
}
