// ============================================
// Rent storage
// POST /api/businesses/[id]/storage/godown
// ============================================

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePlayerId, validationError, handleApiError } from '@/lib/errors';
import { getCurrentGameDay } from '@/lib/game/seasons/seasons';
import { rentGodown } from '@/lib/game/storage/storage-service';
import { GODOWN_TIER_IDS, STORAGE_CONFIG } from '@/lib/game/storage/storage-config';

const rentSchema = z.object({
  tier: z.enum(GODOWN_TIER_IDS as unknown as [string, ...string[]]),
  termDays: z.number().int().refine(
    v => (STORAGE_CONFIG.termOptions as readonly number[]).includes(v),
    { message: `Term must be one of: ${STORAGE_CONFIG.termOptions.join(', ')} days` },
  ),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const playerId = await requirePlayerId();
    const { id } = await params;
    const body = rentSchema.parse(await request.json());

    const result = await rentGodown({
      businessId: id,
      playerId,
      tier: body.tier as 'SMALL' | 'MEDIUM' | 'LARGE',
      termDays: body.termDays,
      gameDay: await getCurrentGameDay(),
    });

    // A refusal here is the shop's circumstances, not a malformed request —
    // not enough cash, or already at the rental limit.
    if (!result.ok) throw validationError(result.message ?? 'Could not rent that space.');

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
