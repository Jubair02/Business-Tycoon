// ============================================
// Bangladesh Business Tycoon - Campaign Analytics API
// Phase 4: Marketing analytics for a business
// ============================================

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  requirePlayerId,
  notFound,
  forbidden,
  handleApiError,
  successResponse,
} from '@/lib/errors';
import {
  calculateCampaignROI,
  calculateCampaignEffectiveness,
  calculateBrandAwarenessDemandBonus,
  calculateCombinedMarketingModifier,
  calculateCampaignDemandModifier,
} from '@/lib/game/marketing/marketing-formulas';
import { getChannelConfig } from '@/lib/game/marketing/marketing-config';

// ---- GET: Marketing analytics for a business ----

export async function GET(
  _request: NextRequest,
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

    // Fetch all campaigns for this business
    const allCampaigns = await db.marketingCampaign.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      include: {
        metrics: {
          orderBy: { gameDay: 'desc' },
          take: 30,
        },
      },
    });

    const activeCampaigns = allCampaigns.filter((c) => c.status === 'ACTIVE');

    // ---- Brand awareness score ----
    const brandAwareness = business.brandAwareness ?? 0;

    // ---- Active campaigns count ----
    const activeCampaignsCount = activeCampaigns.length;

    // ---- Total daily spend (sum of active campaigns' daily budgets) ----
    const totalDailySpend = activeCampaigns.reduce((sum, c) => sum + c.dailyBudget, 0);

    // ---- Combined demand modifier ----
    // Calculate each active campaign's demand modifier, then combine
    // Use totalConversions as proxy for campaign-driven conversions
    const campaignModifiers = activeCampaigns.map((c) => {
      // Estimate baseline customers from business reputation (rough proxy)
      const baselineCustomers = Math.max(10, business.reputation * 2);
      return calculateCampaignDemandModifier(c.totalConversions, baselineCustomers);
    });
    const combinedDemandModifier = calculateCombinedMarketingModifier(campaignModifiers);

    // ---- Brand awareness demand bonus ----
    const brandAwarenessBonus = calculateBrandAwarenessDemandBonus(brandAwareness);

    // ---- Campaign performance comparison (sorted by ROI, best first) ----
    const campaignPerformance = allCampaigns
      .map((c) => {
        const roi = calculateCampaignROI(c.totalSpend, c.revenueInfluenced);
        const effectiveness = calculateCampaignEffectiveness(
          c.totalConversions,
          c.totalReach,
          c.totalSpend,
          c.revenueInfluenced,
        );
        const channelConfig = getChannelConfig(c.channel);

        return {
          id: c.id,
          name: c.name,
          channel: c.channel,
          channelName: channelConfig?.name ?? c.channel,
          channelIcon: channelConfig?.icon ?? '',
          status: c.status,
          totalSpend: c.totalSpend,
          totalReach: c.totalReach,
          totalConversions: c.totalConversions,
          revenueInfluenced: c.revenueInfluenced,
          roi,
          effectiveness,
          costPerConversion: c.totalConversions > 0 ? c.totalSpend / c.totalConversions : 0,
          daysRun: c.daysRun,
          duration: c.duration,
        };
      })
      .sort((a, b) => b.roi - a.roi);

    // ---- Channel effectiveness comparison ----
    // Aggregate performance by channel across all campaigns
    const channelMap = new Map<string, {
      channel: string;
      channelName: string;
      channelIcon: string;
      totalSpend: number;
      totalReach: number;
      totalConversions: number;
      revenueInfluenced: number;
      campaignCount: number;
    }>();

    for (const c of allCampaigns) {
      const existing = channelMap.get(c.channel);
      const channelConfig = getChannelConfig(c.channel);

      if (existing) {
        existing.totalSpend += c.totalSpend;
        existing.totalReach += c.totalReach;
        existing.totalConversions += c.totalConversions;
        existing.revenueInfluenced += c.revenueInfluenced;
        existing.campaignCount += 1;
      } else {
        channelMap.set(c.channel, {
          channel: c.channel,
          channelName: channelConfig?.name ?? c.channel,
          channelIcon: channelConfig?.icon ?? '',
          totalSpend: c.totalSpend,
          totalReach: c.totalReach,
          totalConversions: c.totalConversions,
          revenueInfluenced: c.revenueInfluenced,
          campaignCount: 1,
        });
      }
    }

    const channelEffectiveness = Array.from(channelMap.values())
      .map((ch) => ({
        ...ch,
        roi: calculateCampaignROI(ch.totalSpend, ch.revenueInfluenced),
        effectiveness: calculateCampaignEffectiveness(
          ch.totalConversions,
          ch.totalReach,
          ch.totalSpend,
          ch.revenueInfluenced,
        ),
        costPerConversion: ch.totalConversions > 0 ? ch.totalSpend / ch.totalConversions : 0,
      }))
      .sort((a, b) => b.effectiveness - a.effectiveness);

    // ---- Recent daily metrics (last 30 days aggregated across all campaigns) ----
    // Collect all metrics from all campaigns, group by gameDay
    const dailyMetricsMap = new Map<number, {
      gameDay: number;
      totalSpend: number;
      totalReach: number;
      totalConversions: number;
      revenueInfluenced: number;
    }>();

    for (const c of allCampaigns) {
      for (const m of c.metrics) {
        const existing = dailyMetricsMap.get(m.gameDay);
        if (existing) {
          existing.totalSpend += m.dailySpend;
          existing.totalReach += m.dailyReach;
          existing.totalConversions += m.dailyConversions;
          existing.revenueInfluenced += m.revenueInfluenced;
        } else {
          dailyMetricsMap.set(m.gameDay, {
            gameDay: m.gameDay,
            totalSpend: m.dailySpend,
            totalReach: m.dailyReach,
            totalConversions: m.dailyConversions,
            revenueInfluenced: m.revenueInfluenced,
          });
        }
      }
    }

    // Sort by gameDay descending, take last 30
    const recentDailyMetrics = Array.from(dailyMetricsMap.values())
      .sort((a, b) => b.gameDay - a.gameDay)
      .slice(0, 30);

    return successResponse({
      businessId,
      brandAwareness,
      brandAwarenessBonus,
      activeCampaignsCount,
      totalDailySpend,
      combinedDemandModifier,
      campaignPerformance,
      channelEffectiveness,
      recentDailyMetrics,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
