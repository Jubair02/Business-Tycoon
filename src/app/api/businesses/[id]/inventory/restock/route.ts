// ============================================
// Standing restock order
// POST /api/businesses/[id]/inventory/restock   — restock everything now
// PUT  /api/businesses/[id]/inventory/restock   — save the standing order
// ============================================
//
// Stock empties in about a game day, so restocking by hand was the game's most
// repeated action and the one players complained about. POST is the bulk
// "Restock all" button; PUT stores the standing order the tick then runs on the
// player's behalf.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  requirePlayerId,
  notFound,
  forbidden,
  handleApiError,
  restockSettingsSchema,
  manualRestockSchema,
} from '@/lib/errors';
import { runRestock } from '@/lib/game/operations/auto-restock';
import { trackServer } from '@/lib/analytics/identity';
import { EVENTS } from '@/lib/analytics/events';

async function requireOwnedBusiness(id: string, playerId: string) {
  const business = await db.business.findUnique({
    where: { id },
    select: { id: true, playerId: true },
  });
  if (!business) throw notFound('Business');
  if (business.playerId !== playerId) throw forbidden();
  return business;
}

/** Restock every shelf right now, out of the player's cash. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const playerId = await requirePlayerId();
    const { id } = await params;
    await requireOwnedBusiness(id, playerId);

    // An empty body means "fill the shelves", which is what the button does.
    const raw = await request.json().catch(() => ({}));
    const { target } = manualRestockSchema.parse(raw ?? {});

    const result = await runRestock(id, {
      // A manual top-up ignores the trigger level — the player asked for it, so
      // every shelf below the target gets filled, not only the near-empty ones.
      overrideSettings: { threshold: 1, target, budget: null },
    });

    return NextResponse.json({
      success: true,
      restocked: result.restocked,
      totalCost: Math.round(result.totalCost),
      unitsBought: result.lines.reduce((sum, l) => sum + l.quantity, 0),
      lines: result.lines,
      shortOfFunds: result.skipped.length > 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Save the standing order this business runs each tick. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const playerId = await requirePlayerId();
    const { id } = await params;
    await requireOwnedBusiness(id, playerId);

    const settings = restockSettingsSchema.parse(await request.json());

    const updated = await db.business.update({
      where: { id },
      data: {
        autoRestock: settings.autoRestock,
        autoRestockThreshold: settings.autoRestockThreshold,
        autoRestockTarget: settings.autoRestockTarget,
        autoRestockBudget: settings.autoRestockBudget,
      },
      select: {
        autoRestock: true,
        autoRestockThreshold: true,
        autoRestockTarget: true,
        autoRestockBudget: true,
      },
    });

    void trackServer(EVENTS.RESTOCK_ORDER_SET, { enabled: updated.autoRestock });

    return NextResponse.json({ success: true, settings: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
