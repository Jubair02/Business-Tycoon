// ============================================
// Bangladesh Business Tycoon - Marketing Config
// Phase 4: Marketing channels, costs, and tuning
// ============================================

/** Marketing channel types */
export type MarketingChannel = 
  | 'SOCIAL_MEDIA' 
  | 'FACEBOOK_ADS' 
  | 'LOCAL_ADS' 
  | 'INFLUENCER' 
  | 'BILLBOARD' 
  | 'TV_MEDIA';

/** Campaign status */
export type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

/** Target segment for campaign (null = all segments) */
export type CampaignTargetSegment = 'BUDGET' | 'REGULAR' | 'PREMIUM' | 'TOURIST' | null;

// ---- Channel Definitions ----
// Each channel has unique cost, reach, and effectiveness characteristics
export const MARKETING_CHANNELS: Record<MarketingChannel, {
  id: MarketingChannel;
  name: string;
  icon: string;
  description: string;
  /** Base daily cost in Taka (at default budget) */
  baseDailyCost: number;
  /** Reach multiplier: how many potential customers per taka spent */
  reachPerTaka: number;
  /** Base conversion rate (fraction of reach that becomes customers) */
  baseConversionRate: number;
  /** Which segments this channel is most effective for (multiplier) */
  segmentAffinity: Record<string, number>;
  /** Diminishing returns exponent (< 1 means diminishing returns on spending) */
  diminishingReturns: number;
  /** Minimum business level required to use this channel */
  minLevel: number;
  /** Whether AI players can use this channel */
  aiAvailable: boolean;
}> = {
  SOCIAL_MEDIA: {
    id: 'SOCIAL_MEDIA',
    name: 'Social Media',
    icon: '📱',
    description: 'Organic and paid social media posts. Low cost, moderate reach.',
    baseDailyCost: 500,
    reachPerTaka: 2.0,
    baseConversionRate: 0.03,
    segmentAffinity: { BUDGET: 1.2, REGULAR: 1.0, PREMIUM: 0.7, TOURIST: 1.1 },
    diminishingReturns: 0.6,
    minLevel: 1,
    aiAvailable: true,
  },
  FACEBOOK_ADS: {
    id: 'FACEBOOK_ADS',
    name: 'Facebook Ads',
    icon: '📘',
    description: 'Targeted Facebook advertising. Good reach with precise targeting.',
    baseDailyCost: 1500,
    reachPerTaka: 1.8,
    baseConversionRate: 0.04,
    segmentAffinity: { BUDGET: 1.1, REGULAR: 1.2, PREMIUM: 0.9, TOURIST: 1.3 },
    diminishingReturns: 0.55,
    minLevel: 1,
    aiAvailable: true,
  },
  LOCAL_ADS: {
    id: 'LOCAL_ADS',
    name: 'Local Advertising',
    icon: '📰',
    description: 'Newspaper and local community ads. Reaches local customers well.',
    baseDailyCost: 2000,
    reachPerTaka: 1.5,
    baseConversionRate: 0.035,
    segmentAffinity: { BUDGET: 1.0, REGULAR: 1.3, PREMIUM: 1.1, TOURIST: 0.6 },
    diminishingReturns: 0.5,
    minLevel: 1,
    aiAvailable: true,
  },
  INFLUENCER: {
    id: 'INFLUENCER',
    name: 'Influencer',
    icon: '⭐',
    description: 'Hire local influencers. Expensive but high impact on premium customers.',
    baseDailyCost: 5000,
    reachPerTaka: 1.2,
    baseConversionRate: 0.06,
    segmentAffinity: { BUDGET: 0.5, REGULAR: 0.8, PREMIUM: 1.5, TOURIST: 1.4 },
    diminishingReturns: 0.45,
    minLevel: 2,
    aiAvailable: true,
  },
  BILLBOARD: {
    id: 'BILLBOARD',
    name: 'Billboard',
    icon: '🏪',
    description: 'Physical billboard advertising. High visibility, broad reach.',
    baseDailyCost: 8000,
    reachPerTaka: 1.0,
    baseConversionRate: 0.025,
    segmentAffinity: { BUDGET: 0.8, REGULAR: 1.0, PREMIUM: 1.2, TOURIST: 1.5 },
    diminishingReturns: 0.4,
    minLevel: 3,
    aiAvailable: false,
  },
  TV_MEDIA: {
    id: 'TV_MEDIA',
    name: 'TV/Media',
    icon: '📺',
    description: 'Television and radio advertising. Maximum reach, highest cost.',
    baseDailyCost: 20000,
    reachPerTaka: 0.8,
    baseConversionRate: 0.02,
    segmentAffinity: { BUDGET: 1.3, REGULAR: 1.1, PREMIUM: 1.0, TOURIST: 1.2 },
    diminishingReturns: 0.35,
    minLevel: 4,
    aiAvailable: false,
  },
};

// ---- Marketing Config ----
export const MARKETING_CONFIG = {
  /** Maximum active campaigns per business */
  maxActiveCampaignsPerBusiness: 3,

  /** Maximum total daily marketing spend as fraction of daily revenue */
  maxSpendRevenueRatio: 0.5,

  /** Brand awareness decay per day (fraction lost) */
  brandAwarenessDecay: 0.02,

  /** Brand awareness gain from campaign (per reach unit) */
  brandAwarenessGainPerReach: 0.01,

  /** Maximum brand awareness score */
  maxBrandAwareness: 100,

  /** Brand awareness demand bonus: at max awareness, this multiplier is added */
  brandAwarenessDemandBonus: 0.3,

  /** Marketing demand modifier cap (never more than this × base customers) */
  demandModifierCap: 1.8,

  /** Marketing demand modifier floor (marketing can never reduce customers) */
  demandModifierFloor: 1.0,

  /** Diminishing returns for stacking campaigns on same business */
  stackingDiminishingReturns: 0.7,

  /** How much satisfaction affects campaign effectiveness (0 = no effect, 1 = full effect) */
  satisfactionEffectOnConversion: 0.3,

  /** Minimum campaign duration in days */
  minDuration: 3,

  /** Maximum campaign duration in days */
  maxDuration: 30,

  /** Default campaign duration */
  defaultDuration: 7,

  /** Campaign ROI calculation window (last N days) */
  roiWindowDays: 7,

  /** Available campaign durations for UI */
  durationOptions: [3, 5, 7, 10, 14, 21, 30],

  /** Available daily budget tiers for UI (in Taka) */
  budgetTiers: [500, 1000, 2000, 5000, 10000, 20000, 50000],
};

// ---- AI Marketing Config ----
export const AI_MARKETING_CONFIG = {
  /** How often AI considers marketing (fraction of ticks) */
  marketingConsiderationRate: 0.3,

  /** Personality marketing eagerness (0 = never, 1 = very eager) */
  personalityMarketingEagerness: {
    CONSERVATIVE: 0.15,
    BALANCED: 0.3,
    AGGRESSIVE: 0.6,
    TRADER: 0.2,
    EXPANSIONIST: 0.5,
  } as Record<string, number>,

  /** AI preferred channels by personality */
  personalityPreferredChannels: {
    CONSERVATIVE: ['LOCAL_ADS', 'SOCIAL_MEDIA'] as MarketingChannel[],
    BALANCED: ['FACEBOOK_ADS', 'SOCIAL_MEDIA', 'LOCAL_ADS'] as MarketingChannel[],
    AGGRESSIVE: ['INFLUENCER', 'FACEBOOK_ADS', 'TV_MEDIA'] as MarketingChannel[],
    TRADER: ['FACEBOOK_ADS', 'SOCIAL_MEDIA'] as MarketingChannel[],
    EXPANSIONIST: ['TV_MEDIA', 'BILLBOARD', 'FACEBOOK_ADS'] as MarketingChannel[],
  } as Record<string, MarketingChannel[]>,

  /** AI budget as fraction of daily revenue */
  aiBudgetRevenueFraction: 0.15,

  /** Max campaigns an AI business can have */
  maxAICampaigns: 2,
};

/** Get all channel IDs */
export function getAllChannelIds(): MarketingChannel[] {
  return Object.keys(MARKETING_CHANNELS) as MarketingChannel[];
}

/** Get channel config */
export function getChannelConfig(channel: string) {
  return MARKETING_CHANNELS[channel as MarketingChannel];
}
