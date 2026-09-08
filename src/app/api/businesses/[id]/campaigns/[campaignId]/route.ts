// ============================================
// Bangladesh Business Tycoon - Campaign Actions API
// Phase 4: Pause, resume, cancel, and get single campaign details
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
  campaignActionSchema,
} from '@/lib/errors';
import { calculateCampaignROI, calculateCampaignEffectiveness } from '@/lib/game/marketing/marketing-formulas';
import { getChannelConfig } from '@/lib/game/marketing/marketing-config';

// ---- PATCH: Pause, resume, or cancel a campaign ----

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; campaignId: string }> }
) {
  try {
    const playerId = await requirePlayerId();
    const { id: businessId, campaignId } = await params;

    // Parse and validate request body
    const body = campaignActionSchema.parse(await request.json());
    const { action } = body;

    // Verify business ownership
    const business = await db.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw notFound('Business');
    }

    if (business.playerId !== playerId) {
      throw forbidden();
    }

    // Fetch the campaign
    const campaign = await db.marketingCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw notFound('Campaign');
    }

    if (campaign.businessId !== businessId) {
      throw validationError('Campaign does not belong to this business');
    }

    // Validate status transitions
    const currentStatus = campaign.status;

    if (action === 'pause') {
      if (currentStatus !== 'ACTIVE') {
        throw validationError(`Cannot pause a campaign with status "${currentStatus}". Only ACTIVE campaigns can be paused.`);
      }
    } else if (action === 'resume') {
      if (currentStatus !== 'PAUSED') {
        throw validationError(`Cannot resume a campaign with status "${currentStatus}". Only PAUSED campaigns can be resumed.`);
      }
    } else if (action === 'cancel') {
      if (currentStatus !== 'ACTIVE' && currentStatus !== 'PAUSED') {
        throw validationError(`Cannot cancel a campaign with status "${currentStatus}". Only ACTIVE or PAUSED campaigns can be cancelled.`);
      }
    }

    // Update campaign status
    const newStatus = action === 'pause' ? 'PAUSED'
      : action === 'resume' ? 'ACTIVE'
      : 'CANCELLED';

    const updatedCampaign = await db.marketingCampaign.update({
      where: { id: campaignId },
      data: { status: newStatus },
    });

    // Compute derived fields for response
    const roi = calculateCampaignROI(updatedCampaign.totalSpend, updatedCampaign.revenueInfluenced);
    const effectiveness = calculateCampaignEffectiveness(
      updatedCampaign.totalConversions,
      updatedCampaign.totalReach,
      updatedCampaign.totalSpend,
      updatedCampaign.revenueInfluenced,
    );
    const channelConfig = getChannelConfig(updatedCampaign.channel);

    return successResponse({
      ...updatedCampaign,
      roi,
      effectiveness,
      channelName: channelConfig?.name ?? updatedCampaign.channel,
      channelIcon: channelConfig?.icon ?? '',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---- GET: Get single campaign details with daily metrics ----

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; campaignId: string }> }
) {
  try {
    const playerId = await requirePlayerId();
    const { id: businessId, campaignId } = await params;

    // Verify business ownership
    const business = await db.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw notFound('Business');
    }

    if (business.playerId !== playerId) {
      throw forbidden();
    }

    // Fetch campaign with recent metrics (last 30 days)
    const campaign = await db.marketingCampaign.findUnique({
      where: { id: campaignId },
      include: {
        metrics: {
          orderBy: { gameDay: 'desc' },
          take: 30,
        },
      },
    });

    if (!campaign) {
      throw notFound('Campaign');
    }

    if (campaign.businessId !== businessId) {
      throw validationError('Campaign does not belong to this business');
    }

    // Compute derived fields
    const roi = calculateCampaignROI(campaign.totalSpend, campaign.revenueInfluenced);
    const effectiveness = calculateCampaignEffectiveness(
      campaign.totalConversions,
      campaign.totalReach,
      campaign.totalSpend,
      campaign.revenueInfluenced,
    );
    const channelConfig = getChannelConfig(campaign.channel);

    // Get current game day for daysRemaining calculation
    const gameDayState = await db.gameState.findUnique({ where: { key: 'gameDay' } });
    const currentGameDay = parseInt(gameDayState?.value || '1', 10);
    const daysRemaining = Math.max(0, campaign.endDay - currentGameDay);

    return successResponse({
      ...campaign,
      roi,
      effectiveness,
      daysRemaining,
      channelName: channelConfig?.name ?? campaign.channel,
      channelIcon: channelConfig?.icon ?? '',
      costPerConversion: campaign.totalConversions > 0 ? campaign.totalSpend / campaign.totalConversions : 0,
      costPerReach: campaign.totalReach > 0 ? campaign.totalSpend / campaign.totalReach : 0,
      // Metrics are already included from the query, ordered by gameDay desc
      dailyMetrics: campaign.metrics.map((m) => ({
        gameDay: m.gameDay,
        dailySpend: m.dailySpend,
        dailyReach: m.dailyReach,
        dailyConversions: m.dailyConversions,
        revenueInfluenced: m.revenueInfluenced,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
