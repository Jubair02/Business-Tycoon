// ============================================
// Bangladesh Business Tycoon - AI Marketing
// Phase 4: AI players make marketing decisions
// ============================================

import { db } from '@/lib/db';
import { AI_MARKETING_CONFIG, MARKETING_CHANNELS, type MarketingChannel } from '../marketing/marketing-config';
import { getPersonalityConfig } from './ai-strategy';
import type { AIPersonality } from './types';

/**
 * Process marketing decisions for all AI players.
 * Called after AI strategic decisions, as a background action
 * (doesn't consume cooldown).
 *
 * AI marketing is simpler than human marketing:
 * - AI picks channels based on personality
 * - AI spends a fraction of revenue
 * - AI doesn't target specific segments
 * - AI auto-pauses campaigns if cash is low
 */
export async function simulateAIMarketingTick(gameDay: number): Promise<void> {
  // Only consider marketing some ticks
  if (Math.random() > AI_MARKETING_CONFIG.marketingConsiderationRate) return;

  const aiPlayers = await db.player.findMany({
    where: { isAI: true },
    select: {
      id: true,
      cash: true,
      netWorth: true,
      personality: true,
      businesses: {
        include: {
          campaigns: {
            where: { status: 'ACTIVE' },
          },
        },
      },
    },
  });

  for (const ai of aiPlayers) {
    const personality = (ai.personality || 'BALANCED') as AIPersonality;
    const config = getPersonalityConfig(personality);
    const eagerness = AI_MARKETING_CONFIG.personalityMarketingEagerness[personality] ?? 0.3;

    for (const biz of ai.businesses) {
      try {
        // Check if we should pause campaigns (cash is low)
        const cashReserve = ai.netWorth * config.cashReserveRatio;
        if (ai.cash < cashReserve * 0.5 && biz.campaigns.length > 0) {
          // Pause all active campaigns
          await db.marketingCampaign.updateMany({
            where: { businessId: biz.id, status: 'ACTIVE' },
            data: { status: 'PAUSED' },
          });
          continue;
        }

        // Resume paused campaigns if cash is ok
        if (ai.cash > cashReserve && biz.campaigns.filter(c => c.status === 'ACTIVE').length < AI_MARKETING_CONFIG.maxAICampaigns) {
          const paused = await db.marketingCampaign.findMany({
            where: { businessId: biz.id, status: 'PAUSED' },
            take: 1,
          });
          if (paused.length > 0) {
            await db.marketingCampaign.update({
              where: { id: paused[0].id },
              data: { status: 'ACTIVE' },
            });
          }
        }

        // Consider launching a new campaign
        const activeCount = biz.campaigns.filter(c => c.status === 'ACTIVE').length;
        if (activeCount >= AI_MARKETING_CONFIG.maxAICampaigns) continue;

        // Eagerness check
        if (Math.random() > eagerness) continue;

        // Only market if business is doing somewhat ok
        if (biz.dailyProfit < -5000) continue;

        // Pick channel based on personality
        const preferredChannels = AI_MARKETING_CONFIG.personalityPreferredChannels[personality] || ['SOCIAL_MEDIA'];
        const availableChannels = preferredChannels.filter(ch => {
          const chConfig = MARKETING_CHANNELS[ch as MarketingChannel];
          return chConfig && biz.level >= chConfig.minLevel && chConfig.aiAvailable;
        });
        if (availableChannels.length === 0) continue;

        const channel = availableChannels[Math.floor(Math.random() * availableChannels.length)] as MarketingChannel;
        const channelConfig = MARKETING_CHANNELS[channel];

        // Calculate budget
        const budget = Math.max(
          channelConfig.baseDailyCost,
          Math.round(AI_MARKETING_CONFIG.aiBudgetRevenueFraction * Math.max(biz.dailyRevenue, 10000))
        );

        // Check if can afford
        if (budget > ai.cash * 0.2) continue;

        // Duration: 5-14 days
        const duration = 5 + Math.floor(Math.random() * 10);
        const totalBudget = budget * duration;

        // Create campaign
        await db.marketingCampaign.create({
          data: {
            businessId: biz.id,
            playerId: ai.id,
            name: `${channelConfig.name} Campaign`,
            channel,
            targetSegment: null, // AI doesn't target segments
            dailyBudget: budget,
            totalBudget,
            duration,
            startDay: gameDay,
            endDay: gameDay + duration,
            status: 'ACTIVE',
          },
        });
      } catch (err) {
        console.error(`[AI Marketing] Error for business ${biz.id}:`, err);
      }
    }
  }
}
