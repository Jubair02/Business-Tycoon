// ============================================
// Bangladesh Business Tycoon - Marketing Types
// Phase 4: Type definitions for marketing system
// ============================================

import type { MarketingChannel, CampaignStatus, CampaignTargetSegment } from './marketing-config';

/** Input for creating a new campaign */
export interface CreateCampaignInput {
  businessId: string;
  name: string;
  channel: MarketingChannel;
  targetSegment: CampaignTargetSegment;
  dailyBudget: number;
  duration: number;
}

/** Campaign performance result from a single tick */
export interface CampaignTickResult {
  campaignId: string;
  dailySpend: number;
  dailyReach: number;
  dailyConversions: number;
  demandModifier: number;
  brandAwarenessGain: number;
}

/** Aggregate marketing effect for a business (all active campaigns combined) */
export interface BusinessMarketingEffect {
  businessId: string;
  totalDailySpend: number;
  totalDailyReach: number;
  totalConversions: number;
  combinedDemandModifier: number;
  brandAwarenessDelta: number;
  campaignResults: CampaignTickResult[];
}

/** Campaign analytics for UI */
export interface CampaignAnalytics {
  campaignId: string;
  campaignName: string;
  channel: MarketingChannel;
  status: CampaignStatus;
  totalSpend: number;
  totalReach: number;
  totalConversions: number;
  revenueInfluenced: number;
  roi: number;           // (revenueInfluenced - totalSpend) / totalSpend
  effectiveness: number; // 0-1
  costPerConversion: number;
  costPerReach: number;
  daysRun: number;
  daysRemaining: number;
  dailyMetrics: {
    gameDay: number;
    dailySpend: number;
    dailyReach: number;
    dailyConversions: number;
    revenueInfluenced: number;
  }[];
}

/** Marketing summary for a business */
export interface BusinessMarketingSummary {
  businessId: string;
  brandAwareness: number;
  activeCampaigns: number;
  totalDailySpend: number;
  combinedDemandModifier: number;
  campaigns: {
    id: string;
    name: string;
    channel: MarketingChannel;
    channelName: string;
    channelIcon: string;
    status: CampaignStatus;
    dailyBudget: number;
    daysRun: number;
    duration: number;
    totalSpend: number;
    totalReach: number;
    totalConversions: number;
    effectiveness: number;
    roi: number;
  }[];
}

// Re-export config types for convenience
export type { MarketingChannel, CampaignStatus, CampaignTargetSegment };
