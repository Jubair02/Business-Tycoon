// ============================================
// Bangladesh Business Tycoon - Campaigns API
// Phase 4: Create & list marketing campaigns
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  requirePlayerId,
  notFound,
  forbidden,
  validationError,
  handleApiError,
  successResponse,
  createCampaignSchema,
} from '@/lib/errors';
import { validateCampaign, calculateCampaignROI, calculateCampaignEffectiveness } from '@/lib/game/marketing/marketing-formulas';
import { getChannelConfig } from '@/lib/game/marketing/marketing-config';
import type { MarketingChannel } from '@/lib/game/marketing/marketing-config';

// ---- POST: Create a new marketing campaign ----

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const playerId = await requirePlayerId();
    const { id: businessId } = await params;

    // Parse and validate request body
    const body = createCampaignSchema.parse(await request.json());
    const { name, channel, targetSegment, dailyBudget, duration } = body;

    // Verify business exists and belongs to player
    const business = await db.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw notFound('Business');
    }

    if (business.playerId !== playerId) {
      throw forbidden();
    }

    // Get current game day
    const gameDayState = await db.gameState.findUnique({ where: { key: 'gameDay' } });
    const gameDay = parseInt(gameDayState?.value || '1', 10);

    // Count active campaigns for this business
    const activeCampaignCount = await db.marketingCampaign.count({
      where: { businessId, status: 'ACTIVE' },
    });

    // Get player cash for validation
    const player = await db.player.findUnique({ where: { id: playerId } });
    if (!player) {
      throw notFound('Player');
    }

    // Validate campaign using marketing formulas
    const validationErrors = validateCampaign(
      channel as MarketingChannel,
      dailyBudget,
      duration,
      business.level,
      activeCampaignCount,
      player.cash,
    );

    if (validationErrors.length > 0) {
      throw validationError(validationErrors.join('; '));
    }

    // Calculate total budget
    const totalBudget = dailyBudget * duration;

    // Create campaign in a transaction (deduct first day's budget from player cash)
    const campaign = await db.$transaction(async (tx) => {
      // Re-check player cash inside transaction
      const txPlayer = await tx.player.findUnique({ where: { id: playerId } });
      if (!txPlayer || txPlayer.cash < dailyBudget) {
        throw validationError('Not enough cash for the first day of this campaign');
      }

      // Deduct first day's budget
      await tx.player.update({
        where: { id: playerId },
        data: { cash: { decrement: dailyBudget } },
      });

      // Create the campaign
      return tx.marketingCampaign.create({
        data: {
          businessId,
          playerId,
          name,
          channel,
          targetSegment: targetSegment ?? null,
          dailyBudget,
          totalBudget,
          duration,
          startDay: gameDay,
          endDay: gameDay + duration,
          status: 'ACTIVE',
          daysRun: 1,
          totalSpend: dailyBudget,
        },
      });
    });

    return NextResponse.json(
      { success: true, data: campaign },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// ---- GET: List all campaigns for a business ----

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const playerId = await requirePlayerId();
    const { id: businessId } = await params;

    // Verify business exists and belongs to player
    const business = await db.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw notFound('Business');
    }

    if (business.playerId !== playerId) {
      throw forbidden();
    }

    // Parse query params for status filtering
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || undefined;

    // Build where clause
    const where: { businessId: string; status?: string } = { businessId };
    if (statusFilter) {
      where.status = statusFilter;
    }

    // Fetch campaigns
    const campaigns = await db.marketingCampaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Compute ROI and effectiveness for each campaign
    const campaignsComputed = campaigns.map((c) => {
      const roi = calculateCampaignROI(c.totalSpend, c.revenueInfluenced);
      const effectiveness = calculateCampaignEffectiveness(
        c.totalConversions,
        c.totalReach,
        c.totalSpend,
        c.revenueInfluenced,
      );
      const channelConfig = getChannelConfig(c.channel);

      return {
        ...c,
        roi,
        effectiveness,
        channelName: channelConfig?.name ?? c.channel,
        channelIcon: channelConfig?.icon ?? '',
        costPerConversion: c.totalConversions > 0 ? c.totalSpend / c.totalConversions : 0,
      };
    });

    return successResponse(campaignsComputed);
  } catch (error) {
    return handleApiError(error);
  }
}
