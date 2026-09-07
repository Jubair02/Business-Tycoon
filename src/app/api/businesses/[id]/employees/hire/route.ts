import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { GAME_CONFIG, getRandomName, EMPLOYEE_ROLES } from '@/lib/game-data';
import { requirePlayerId, notFound, forbidden, validationError, handleApiError, hireEmployeeSchema } from '@/lib/errors';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const playerId = await requirePlayerId();

    const { id } = await params;
    const body = hireEmployeeSchema.parse(await request.json());
    const { role } = body;

    const roleDef = EMPLOYEE_ROLES.find((r) => r.role === role);

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

    // Generate employee stats
    const name = getRandomName();
    const salaryVariation = 1 + Math.random() * 0.3;
    const salary = Math.round(roleDef!.baseSalary * salaryVariation);
    const skill = Math.floor(Math.random() * 7) + 3; // 3-9
    const efficiency = 0.5 + skill * GAME_CONFIG.employeeEfficiencyPerSkill;

    const employee = await db.$transaction(async (tx) => {
      // Check max employees inside transaction to prevent race conditions
      const currentBusiness = await tx.business.findUnique({
        where: { id },
        include: { employees: true },
      });

      if (!currentBusiness) {
        throw notFound('Business');
      }

      if (currentBusiness.employees.length >= GAME_CONFIG.maxEmployees) {
        throw validationError(`Maximum ${GAME_CONFIG.maxEmployees} employees per business`);
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
    return handleApiError(error);
  }
}
