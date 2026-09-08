// ============================================
// Bangladesh Business Tycoon - Marketing Formulas
// Phase 4: Campaign reach, conversions, demand modifiers, brand awareness, ROI
//
// Design Principles:
// 1. Diminishing returns — unlimited spending cannot overpower growth
// 2. Marketing doesn't guarantee success — depends on satisfaction and segment fit
// 3. No double-counting — marketing demand modifier is separate from CX and price
// 4. Campaign costs are real — deducted from player cash
// 5. AI uses the same formulas — no special AI-only logic
// ============================================

import {
  MARKETING_CHANNELS,
  MARKETING_CONFIG,
  type MarketingChannel,
  type CampaignTargetSegment,
} from './marketing-config';
import type {
  CampaignTickResult,
  BusinessMarketingEffect,
} from './types';

// ============================================
// 1. CAMPAIGN DAILY SPEND
// ============================================

/**
 * Calculate the actual daily spend for a campaign.
 * This equals the daily budget (player-set), clamped to remaining budget.
 *
 * @param dailyBudget - The campaign's daily budget
 * @param totalSpendSoFar - How much has been spent already
 * @param totalBudget - The campaign's total budget cap
 * @returns Actual spend this tick
 */
export function calculateCampaignDailySpend(
  dailyBudget: number,
  totalSpendSoFar: number,
  totalBudget: number,
): number {
  const remainingBudget = Math.max(0, totalBudget - totalSpendSoFar);
  return Math.min(dailyBudget, remainingBudget);
}

// ============================================
// 2. CAMPAIGN REACH
// ============================================

/**
 * Calculate campaign reach (impressions) for one tick.
 *
 * Formula:
 *   reach = baseReach × (dailySpend / baseDailyCost)^diminishingReturns × channelReachPerTaka × dailySpend
 *
 * The diminishing returns exponent (< 1) means doubling spend less than doubles reach.
 * E.g., with exponent 0.6: 2x spend = 1.52x reach, 10x spend = 3.98x reach
 *
 * @param channel - Marketing channel type
 * @param dailySpend - Actual daily spend
 * @param businessLevel - Business level (affects reach)
 * @returns Estimated reach/impressions
 */
export function calculateCampaignReach(
  channel: MarketingChannel,
  dailySpend: number,
  businessLevel: number,
): number {
  const channelConfig = MARKETING_CHANNELS[channel];
  if (!channelConfig || dailySpend <= 0) return 0;

  // Diminishing returns: spend more than base cost gives sub-linear returns
  const spendRatio = dailySpend / channelConfig.baseDailyCost;
  const diminishingReach = Math.pow(spendRatio, channelConfig.diminishingReturns);

  // Base reach = how many people see the ad
  const baseReach = channelConfig.reachPerTaka * dailySpend;

  // Apply diminishing returns on top of base reach
  const reach = baseReach * diminishingReach;

  // Level bonus: each level adds 8% more reach (better brand, bigger store)
  const levelBonus = 1 + Math.max(0, businessLevel - 1) * 0.08;

  // Random variation ±15%
  const variation = 1 + (Math.random() * 2 - 1) * 0.15;

  return Math.max(0, Math.floor(reach * levelBonus * variation));
}

// ============================================
// 3. CAMPAIGN CONVERSIONS
// ============================================

/**
 * Calculate how many customers are acquired from a campaign.
 *
 * Formula:
 *   conversions = reach × baseConversionRate × satisfactionFactor × segmentFactor
 *
 * Marketing is NOT a guaranteed sale — it depends on:
 * - Business satisfaction (unhappy customers don't convert from ads)
 * - Segment match (targeting the right segment matters)
 *
 * @param channel - Marketing channel type
 * @param reach - Campaign reach this tick
 * @param satisfactionScore - Business satisfaction 0-100
 * @param targetSegment - Which segment the campaign targets (null = all)
 * @param segmentDemands - Current segment demand multipliers from CX
 * @returns Number of customers converted
 */
export function calculateCampaignConversions(
  channel: MarketingChannel,
  reach: number,
  satisfactionScore: number,
  targetSegment: CampaignTargetSegment,
  segmentDemands: { segment: string; demandMultiplier: number }[],
): number {
  const channelConfig = MARKETING_CHANNELS[channel];
  if (!channelConfig || reach <= 0) return 0;

  // Satisfaction factor: poor satisfaction reduces conversion
  // satisfaction 50 → 1.0, satisfaction 80 → 1.3, satisfaction 20 → 0.4
  const satisfactionFactor = 0.4 + (satisfactionScore / 100) * 0.9;
  const effectiveSatisfactionFactor = 1 - MARKETING_CONFIG.satisfactionEffectOnConversion +
    MARKETING_CONFIG.satisfactionEffectOnConversion * satisfactionFactor;

  // Segment affinity: how well this channel reaches the target segment
  let segmentFactor = 1.0;
  if (targetSegment && segmentDemands.length > 0) {
    // Targeted campaign: use the affinity for the target segment
    const affinity = channelConfig.segmentAffinity[targetSegment] || 1.0;
    const segmentDemand = segmentDemands.find(s => s.segment === targetSegment);
    // Boost if the target segment already finds business attractive
    const demandBoost = segmentDemand ? Math.min(1.5, 0.5 + segmentDemand.demandMultiplier) : 1.0;
    segmentFactor = affinity * demandBoost;
  } else {
    // Untargeted campaign: weighted average across all segments
    const segments = Object.entries(channelConfig.segmentAffinity);
    const totalWeight = segments.reduce((sum, [, w]) => sum + w, 0);
    segmentFactor = segments.reduce((sum, [, w]) => sum + w, 0) / totalWeight; // Average affinity
  }

  const conversions = reach * channelConfig.baseConversionRate * effectiveSatisfactionFactor * segmentFactor;

  // Add random variation ±20%
  const variation = 1 + (Math.random() * 2 - 1) * 0.2;

  return Math.max(0, Math.floor(conversions * variation));
}

// ============================================
// 4. CAMPAIGN DEMAND MODIFIER
// ============================================

/**
 * Calculate how much a single campaign boosts demand for a business.
 *
 * This is a multiplier on the base customer count.
 * More conversions → more demand, but with diminishing returns.
 *
 * Formula:
 *   modifier = 1 + (conversions / baselineCustomers) × conversionWeight
 *   Where conversionWeight ensures the boost is meaningful but bounded.
 *
 * @param conversions - Customers acquired from this campaign
 * @param baselineCustomers - Business's base customer count (for scaling)
 * @returns Demand modifier (1.0 = no effect, 1.5 = 50% more customers)
 */
export function calculateCampaignDemandModifier(
  conversions: number,
  baselineCustomers: number,
): number {
  if (conversions <= 0) return 1.0;

  // Scale relative to baseline: 10 conversions for a 50-customer business = big boost
  // but 10 conversions for a 500-customer business = small boost
  const baseline = Math.max(baselineCustomers, 10); // Avoid division by tiny numbers
  const conversionRatio = conversions / baseline;

  // Diminishing returns: each additional conversion has less impact
  // Using sqrt gives good early returns but tapers off
  const boost = Math.sqrt(conversionRatio) * 0.8;

  return 1 + boost;
}

// ============================================
// 5. COMBINED MARKETING DEMAND MODIFIER
// ============================================

/**
 * Combine demand modifiers from all active campaigns with stacking diminishing returns.
 *
 * Stacking campaigns has sub-linear benefit: 2 campaigns < 2× single campaign effect.
 *
 * Formula:
 *   combined = 1 + sum(modifier_i - 1) ^ stackingDiminishingReturns
 *
 * @param campaignModifiers - Demand modifiers from each active campaign
 * @returns Combined demand modifier, clamped to [floor, cap]
 */
export function calculateCombinedMarketingModifier(
  campaignModifiers: number[],
): number {
  if (campaignModifiers.length === 0) return 1.0;

  // Sum the boosts (each modifier - 1 is the boost part)
  const totalBoost = campaignModifiers.reduce((sum, mod) => sum + Math.max(0, mod - 1), 0);

  // Apply stacking diminishing returns
  const effectiveBoost = Math.pow(totalBoost, MARKETING_CONFIG.stackingDiminishingReturns);

  // Clamp to bounds
  return Math.max(
    MARKETING_CONFIG.demandModifierFloor,
    Math.min(MARKETING_CONFIG.demandModifierCap, 1 + effectiveBoost)
  );
}

// ============================================
// 6. BRAND AWARENESS UPDATE
// ============================================

/**
 * Calculate new brand awareness score.
 *
 * Brand awareness:
 * - Decays naturally each day (forgetting)
 * - Increases from campaign reach
 * - Is smoothed to prevent wild swings
 * - Capped at 100
 *
 * Formula:
 *   awareness = (current × (1 - decay)) + (reach × gainPerReach)
 *   clamped to [0, maxBrandAwareness]
 *
 * @param currentAwareness - Current brand awareness 0-100
 * @param totalReach - Total campaign reach this tick
 * @returns Updated brand awareness
 */
export function calculateBrandAwareness(
  currentAwareness: number,
  totalReach: number,
): number {
  // Natural decay
  const decayed = currentAwareness * (1 - MARKETING_CONFIG.brandAwarenessDecay);

  // Gain from reach (with diminishing returns for very large reach)
  const reachGain = Math.min(
    totalReach * MARKETING_CONFIG.brandAwarenessGainPerReach,
    5 // Max +5 per day from campaigns (prevents instant max)
  );

  return Math.max(0, Math.min(MARKETING_CONFIG.maxBrandAwareness, decayed + reachGain));
}

// ============================================
// 7. BRAND AWARENESS DEMAND BONUS
// ============================================

/**
 * Calculate the demand bonus from brand awareness.
 *
 * At 0 awareness: no bonus (1.0)
 * At 50 awareness: +15% customers (1.15)
 * At 100 awareness: +30% customers (1.30)
 *
 * @param brandAwareness - Current brand awareness 0-100
 * @returns Demand multiplier from brand awareness
 */
export function calculateBrandAwarenessDemandBonus(brandAwareness: number): number {
  return 1 + (brandAwareness / MARKETING_CONFIG.maxBrandAwareness) * MARKETING_CONFIG.brandAwarenessDemandBonus;
}

// ============================================
// 8. CAMPAIGN EFFECTIVENESS
// ============================================

/**
 * Calculate campaign effectiveness score (0-1).
 *
 * Combines multiple signals:
 * - Conversion rate vs expected (are we converting as expected?)
 * - ROI (is the campaign profitable?)
 * - Reach efficiency (are we reaching people efficiently?)
 *
 * @param totalConversions - Total customers acquired
 * @param totalReach - Total impressions
 * @param totalSpend - Total taka spent
 * @param revenueInfluenced - Revenue attributed to campaign
 * @returns Effectiveness score 0-1
 */
export function calculateCampaignEffectiveness(
  totalConversions: number,
  totalReach: number,
  totalSpend: number,
  revenueInfluenced: number,
): number {
  if (totalSpend <= 0) return 0;

  // Conversion rate (actual vs expected ~3-4%)
  const actualConvRate = totalReach > 0 ? totalConversions / totalReach : 0;
  const expectedConvRate = 0.035; // Rough expected rate
  const conversionScore = Math.min(1, actualConvRate / expectedConvRate);

  // ROI score (revenue / spend)
  const roi = revenueInfluenced / totalSpend;
  const roiScore = Math.min(1, Math.max(0, roi / 3)); // ROI of 3+ = perfect score

  // Reach efficiency (cost per 1000 reach)
  const cpm = totalReach > 0 ? (totalSpend / totalReach) * 1000 : Infinity;
  const reachScore = cpm < 1000 ? 1 : cpm < 5000 ? 0.7 : cpm < 10000 ? 0.4 : 0.2;

  // Weighted combination
  return Math.max(0, Math.min(1, 
    conversionScore * 0.4 + roiScore * 0.35 + reachScore * 0.25
  ));
}

// ============================================
// 9. CAMPAIGN ROI
// ============================================

/**
 * Calculate campaign ROI.
 * 
 * ROI = (revenueInfluenced - totalSpend) / totalSpend
 * ROI of 0 = break even, ROI of 1 = doubled money, ROI of -0.5 = lost half
 */
export function calculateCampaignROI(
  totalSpend: number,
  revenueInfluenced: number,
): number {
  if (totalSpend <= 0) return 0;
  return (revenueInfluenced - totalSpend) / totalSpend;
}

// ============================================
// 10. CAMPAIGN VALIDATION
// ============================================

/**
 * Validate campaign creation parameters.
 * Returns list of errors (empty = valid).
 */
export function validateCampaign(
  channel: MarketingChannel,
  dailyBudget: number,
  duration: number,
  businessLevel: number,
  activeCampaignCount: number,
  playerCash: number,
): string[] {
  const errors: string[] = [];
  const channelConfig = MARKETING_CHANNELS[channel];

  if (!channelConfig) {
    errors.push('Invalid marketing channel');
    return errors;
  }

  if (businessLevel < channelConfig.minLevel) {
    errors.push(`Business level ${businessLevel} too low for ${channelConfig.name} (requires level ${channelConfig.minLevel})`);
  }

  if (dailyBudget < channelConfig.baseDailyCost * 0.5) {
    errors.push(`Daily budget too low for ${channelConfig.name} (minimum ৳${Math.round(channelConfig.baseDailyCost * 0.5).toLocaleString()})`);
  }

  if (dailyBudget > channelConfig.baseDailyCost * 20) {
    errors.push(`Daily budget too high for ${channelConfig.name} (maximum ৳${Math.round(channelConfig.baseDailyCost * 20).toLocaleString()})`);
  }

  if (duration < MARKETING_CONFIG.minDuration) {
    errors.push(`Duration too short (minimum ${MARKETING_CONFIG.minDuration} days)`);
  }

  if (duration > MARKETING_CONFIG.maxDuration) {
    errors.push(`Duration too long (maximum ${MARKETING_CONFIG.maxDuration} days)`);
  }

  if (activeCampaignCount >= MARKETING_CONFIG.maxActiveCampaignsPerBusiness) {
    errors.push(`Maximum ${MARKETING_CONFIG.maxActiveCampaignsPerBusiness} active campaigns per business`);
  }

  // Check if player can afford first day
  if (dailyBudget > playerCash) {
    errors.push('Not enough cash for even one day of this campaign');
  }

  return errors;
}
