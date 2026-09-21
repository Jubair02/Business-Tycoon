// ============================================
// Change a rental
// PATCH /api/businesses/[id]/storage/godown/[godownId]
// ============================================

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePlayerId, validationError, handleApiError } from '@/lib/errors';
import { setGodownAutoRenew } from '@/lib/game/storage/storage-service';

const patchSchema = z.object({ autoRenew: z.boolean() });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; godownId: string }> },
) {
  try {
    const playerId = await requirePlayerId();
    const { godownId } = await params;
    const body = patchSchema.parse(await request.json());

    const result = await setGodownAutoRenew({ godownId, playerId, autoRenew: body.autoRenew });
    if (!result.ok) throw validationError(result.message ?? 'Could not change that rental.');

    return NextResponse.json({ success: true, autoRenew: body.autoRenew });
  } catch (error) {
    return handleApiError(error);
  }
}
