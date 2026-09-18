// ============================================
// Bangladesh Business Tycoon - AI Evaluation & Scoring
// Phase 2: Score-based action selection
//
// Each possible action is scored based on:
//   Action Score = Profit Opportunity
//                 + Market Opportunity
//                 + Personality Weight
//                 - Risk
//                 - Cash Pressure
// ============================================

import type {
  AIDecisionContext,
  ScoredAction,
  AIPersonality,
  AIAction,
} from './types';
import { getPersonalityConfig } from './ai-strategy';
import { BUSINESS_TYPES, CITIES, PRODUCTS } from '@/lib/game-data';
import type { BusinessType } from '@/lib/game-data';
import { AI_MARKETING_CONFIG } from '../marketing/marketing-config';
import { EXPANSION_CONFIG, AI_EXPANSION_CONFIG, calculateExpansionCost } from '../expansion';
import {
  findRivalsInMarket,
  rankMarketsToAttack,
  pickPoachTarget,
  rivalryDrive,
  marketKey,
  RIVALRY_CONFIG,
} from './ai-rivalry';

// ---- Action Scoring Weights ----
// Base scores for each action type (before personality modifiers)
const BASE_ACTION_SCORES: Record<AIAction, number> = {
  BUY_INVENTORY: 50,
  CHANGE_PRICE: 30,
  HIRE_EMPLOYEE: 25,
  POACH_EMPLOYEE: 22,
  UPGRADE_BUSINESS: 20,
  CREATE_BUSINESS: 15,
  SELL_BUSINESS: -10,
  TAKE_LOAN: 5,
  REPAY_LOAN: 10,
  LAUNCH_CAMPAIGN: 15,
  HOLD: 5,
};

/**
 * Evaluate all possible actions for an AI player and return scored options.
 * The highest-scoring action(s) will be executed.
 */
export function evaluateActions(ctx: AIDecisionContext): ScoredAction[] {
  const config = getPersonalityConfig(ctx.personality);
  const actions: ScoredAction[] = [];
  const daysSinceLastAction = ctx.gameDay - ctx.lastActionAt;

  // Respect cooldown
  if (daysSinceLastAction < config.actionCooldownDays) {
    return [{ action: 'HOLD', score: 100 }]; // Cooldown active
  }

  // ---- BUY_INVENTORY ----
  for (const biz of ctx.businesses) {
    for (const inv of biz.inventories) {
      const stockRatio = inv.maxStock > 0 ? inv.quantity / inv.maxStock : 0;
      if (stockRatio < config.inventoryBuyThreshold) {
        // Score based on how low stock is
        const urgency = (1 - stockRatio) * 60;
        const profitPotential = inv.sellPrice > inv.purchasePrice
          ? (inv.sellPrice - inv.purchasePrice) / inv.sellPrice * 40
          : -20;
        const cashPressure = inv.purchasePrice > ctx.cash * 0.5 ? -30 : 0;
        const score = BASE_ACTION_SCORES.BUY_INVENTORY + urgency + profitPotential + cashPressure;
        actions.push({
          action: 'BUY_INVENTORY',
          score,
          target: biz.id,
          params: { inventoryId: inv.id, productName: inv.productName, stockRatio, maxStock: inv.maxStock },
        });
      }
    }
  }

  // ---- CHANGE_PRICE ----
  // Always evaluate but adjust score based on priceAdjustFrequency
  const priceFreqBonus = config.priceAdjustFrequency * 20; // Higher frequency = higher base score
  const drive = rivalryDrive(ctx.personality);
  for (const biz of ctx.businesses) {
    // Score based on business performance - if losing money, more incentive to adjust
    const performanceScore = biz.dailyProfit < 0 ? 40 : 10;

    // A human rival in the same city and trade is a reason to reprice that the
    // AI previously had no way of seeing. The keener the rival is on price, the
    // more urgent this is.
    const rivals = findRivalsInMarket(ctx.rivals, biz.city, biz.type);
    const cheapestRival = rivals.reduce(
      (min, r) => Math.min(min, r.priceIndex),
      Number.POSITIVE_INFINITY,
    );
    const undercutUrgency =
      rivals.length > 0 && Number.isFinite(cheapestRival)
        // Worth most when the rival is at or under the going rate.
        ? Math.max(0, Math.min(35, (1.1 - cheapestRival) * 70)) * drive
        : 0;

    const score = BASE_ACTION_SCORES.CHANGE_PRICE + performanceScore + priceFreqBonus + undercutUrgency;
    actions.push({
      action: 'CHANGE_PRICE',
      score,
      target: biz.id,
      params: { contested: rivals.length > 0 },
    });
  }

  // ---- POACH_EMPLOYEE ----
  // Headhunt a good hand off a human rival in a market this AI trades in.
  // Gated hard: only combative personalities, only off a rival on the same
  // street, only with the wages covered, and only every few days.
  const poachOffCooldown =
    ctx.lastPoachAt === 0 || ctx.gameDay - ctx.lastPoachAt >= RIVALRY_CONFIG.poachCooldownDays;
  if (poachOffCooldown) {
    for (const biz of ctx.businesses) {
      const freeSlots = 5 - biz.employeeCount;
      if (freeSlots <= 0) continue;

      const target = pickPoachTarget({
        rivals: findRivalsInMarket(ctx.rivals, biz.city, biz.type),
        personality: ctx.personality,
        aiCash: ctx.cash,
        freeSlots,
      });
      if (!target) continue;

      // Worth more for a better hand, and more to a business doing well enough
      // to use them.
      const skillScore = target.skill * 3;
      const healthScore = biz.healthScore > 50 ? 12 : -8;
      const score =
        (BASE_ACTION_SCORES.POACH_EMPLOYEE + skillScore + healthScore) * drive;

      actions.push({
        action: 'POACH_EMPLOYEE',
        score,
        target: biz.id,
        params: { poach: target },
      });
    }
  }

  // ---- HIRE_EMPLOYEE ----
  // Always evaluate but adjust score based on hiringPreference
  const hireFreqBonus = config.hiringPreference * 15; // Higher preference = higher base score
  for (const biz of ctx.businesses) {
    if (biz.employeeCount < 5) { // max employees
      // More incentive to hire if business is doing well
      const bizScore = biz.dailyProfit > 0 ? 20 : -10;
      const cashOk = ctx.cash > 50000 ? 0 : -25;
      const score = BASE_ACTION_SCORES.HIRE_EMPLOYEE + bizScore + cashOk + hireFreqBonus;
      actions.push({
        action: 'HIRE_EMPLOYEE',
        score,
        target: biz.id,
      });
    }
  }

  // ---- UPGRADE_BUSINESS ----
  // Always evaluate but adjust score based on upgradeEagerness
  const upgradeFreqBonus = config.upgradeEagerness * 15; // Higher eagerness = higher base score
  for (const biz of ctx.businesses) {
    if (biz.level < 10 && biz.dailyProfit > 0) {
      const bType = BUSINESS_TYPES.find(b => b.id === biz.type);
      const upgradeCost = bType ? bType.investment * biz.level * 0.5 : 100000;
      const canAfford = ctx.cash > upgradeCost * 1.5;
      const score = BASE_ACTION_SCORES.UPGRADE_BUSINESS
        + (canAfford ? 30 : -40)
        + (biz.healthScore > 60 ? 15 : -10)
        + upgradeFreqBonus;
      actions.push({
        action: 'UPGRADE_BUSINESS',
        score,
        target: biz.id,
        params: { upgradeCost },
      });
    }
  }

  // ---- CREATE_BUSINESS ----
  // Phase 5: Use expansion config for limits and cost scaling
  const expandFreqBonus = config.expansionEagerness * 10;
  const existingTypes = new Set(ctx.businesses.map(b => b.type));
  const aiMaxBusinesses = Math.min(EXPANSION_CONFIG.maxBusinessesPerPlayer, AI_EXPANSION_CONFIG.maxAIBusinesses);

  // Phase 5: Check expansion cooldown
  const daysSinceExpansion = ctx.gameDay - ctx.lastExpansionAt;
  const expansionOnCooldown = ctx.lastExpansionAt > 0 && daysSinceExpansion < EXPANSION_CONFIG.expansionCooldownDays;

  // Phase 5: Check business count limit
  const atMaxBusinesses = ctx.businesses.length >= aiMaxBusinesses;

  // Phase 5: Check minimum daily profit for expansion
  const totalDailyProfit = ctx.businesses.reduce((s, b) => s + b.dailyProfit, 0);
  // The profit threshold gates *expansion*, so it cannot apply to an AI that has
  // no businesses yet: with zero businesses total profit is 0, which is below
  // the threshold, and the AI could never open its first business at all.
  const meetsProfitThreshold =
    ctx.businesses.length === 0 ||
    totalDailyProfit >= AI_EXPANSION_CONFIG.minDailyProfitForExpansion;

  // Markets a human player is profiting in, best first. Personalities with
  // little rivalry drive get an empty list and expand on their own logic.
  const attackTargets = rankMarketsToAttack({
    intel: ctx.rivals,
    personality: ctx.personality,
    ownedMarkets: ctx.businesses.map(b => marketKey(b.city, b.type)),
  });

  if (!atMaxBusinesses && !expansionOnCooldown && meetsProfitThreshold) {
    for (const bType of BUSINESS_TYPES) {
      // Phase 5: Calculate actual expansion cost with scaling
      const costInfo = calculateExpansionCost(bType.investment, ctx.businesses.length, '', bType.id);
      const cashAfterExpansion = ctx.cash - costInfo.totalCost;
      const personalityReserve = AI_EXPANSION_CONFIG.aiCashReserveAfterExpansion[ctx.personality] ?? 0.2;
      const minReserve = ctx.netWorth * personalityReserve;

      if (cashAfterExpansion < minReserve) continue; // Can't afford with reserve

      const diversificationBonus = !existingTypes.has(bType.id) ? 20 : 0;
      const cashPressure = cashAfterExpansion < ctx.netWorth * config.cashReserveRatio ? -50 : 0;
      const expansionEagerness = AI_EXPANSION_CONFIG.personalityExpansionEagerness[ctx.personality] ?? 0.5;

      // Open next door to the player where the player is making money. The
      // best-scoring market of this type carries the bonus, and the city is
      // handed to the executor so the shop actually lands there rather than in
      // a random city.
      const targetMarket = attackTargets.find(m => m.type === bType.id);
      const rivalryBonus = targetMarket ? Math.min(35, targetMarket.score * 0.5) : 0;

      const score = BASE_ACTION_SCORES.CREATE_BUSINESS + diversificationBonus + cashPressure
        + expandFreqBonus * expansionEagerness + rivalryBonus;
      actions.push({
        action: 'CREATE_BUSINESS',
        score,
        params: {
          businessType: bType.id,
          // Null means "pick a city the usual way".
          targetCity: targetMarket?.city ?? null,
          rivalryMotivated: Boolean(targetMarket),
        },
      });
    }
  }

  // ---- SELL_BUSINESS ----
  for (const biz of ctx.businesses) {
    // Only sell if business is consistently losing money
    if (biz.healthScore < 20 && biz.dailyProfit < -1000) {
      const score = BASE_ACTION_SCORES.SELL_BUSINESS + (biz.healthScore < 10 ? 40 : 10);
      actions.push({
        action: 'SELL_BUSINESS',
        score,
        target: biz.id,
      });
    }
  }

  // ---- TAKE_LOAN ----
  // Always evaluate but adjust score based on loanWillingness
  const loanFreqBonus = config.loanWillingness * 10; // Higher willingness = higher base score
  const activeLoans = ctx.activeLoans.length;
  if (activeLoans < 2) { // Max 2 loans at a time
    const cashReserve = ctx.netWorth * config.cashReserveRatio;
    const needsCash = ctx.cash < cashReserve;
    const score = BASE_ACTION_SCORES.TAKE_LOAN
      + (needsCash ? 30 : -20)
      + (ctx.businesses.some(b => b.dailyProfit > 0) ? 15 : -15)
      + loanFreqBonus;
    actions.push({
      action: 'TAKE_LOAN',
      score,
    });
  }

  // ---- REPAY_LOAN ----
  for (const loan of ctx.activeLoans) {
    const canRepayFully = ctx.cash > loan.remainingDebt * 1.3;
    const loanBurden = loan.dailyPayment > ctx.businesses.reduce((s, b) => s + b.dailyProfit, 0) * 0.3;
    const score = BASE_ACTION_SCORES.REPAY_LOAN
      + (canRepayFully ? 20 : -10)
      + (loanBurden ? 25 : 0);
    actions.push({
      action: 'REPAY_LOAN',
      score,
      target: loan.id,
    });
  }

  // ---- LAUNCH_CAMPAIGN ----
  // Evaluate marketing opportunities for each business
  const marketingFreqBonus = config.marketingEagerness * 20;
  for (const biz of ctx.businesses) {
    // Count active campaigns (from business context - approximate)
    // AI marketing is also handled separately in ai-marketing.ts
    // This evaluation decides if the AI should prioritize marketing as its strategic action
    const activeCampaigns = (biz as unknown as Record<string, unknown>).activeCampaignCount as number || 0;

    if (activeCampaigns < AI_MARKETING_CONFIG.maxAICampaigns) {
      // Base marketing score
      let mktScore = BASE_ACTION_SCORES.LAUNCH_CAMPAIGN + marketingFreqBonus;

      // Market more when struggling (boost demand)
      if (biz.satisfactionScore < 40) mktScore += 15;

      // Market more when profitable (can afford it)
      if (biz.dailyProfit > 0) {
        mktScore += 10;
      } else {
        mktScore -= 15;
      }

      // Cash check — can't market if broke
      if (ctx.cash < 5000) mktScore -= 20;

      actions.push({
        action: 'LAUNCH_CAMPAIGN',
        score: mktScore,
        target: biz.id,
      });
    }
  }

  // ---- Event Reactions ----
  // Boost BUY_INVENTORY and CHANGE_PRICE scores when relevant events are active
  for (const event of ctx.activeEvents) {
    const effectKeys = Object.keys(event.effects);
    const hasDemandEffect = effectKeys.some(k => k.includes('_demand'));
    const hasPriceEffect = effectKeys.some(k => k.includes('_price'));

    if (hasDemandEffect) {
      // Boost inventory buying for affected business types
      for (const action of actions) {
        if (action.action === 'BUY_INVENTORY') {
          action.score += 15 * config.eventReactivity;
        }
      }
    }
    if (hasPriceEffect) {
      // Boost price adjustments
      for (const action of actions) {
        if (action.action === 'CHANGE_PRICE') {
          action.score += 10 * config.eventReactivity;
        }
      }
    }
  }

  // ---- Personality Modifiers ----
  // Apply personality-specific score adjustments
  for (const action of actions) {
    switch (ctx.personality) {
      case 'CONSERVATIVE':
        if (action.action === 'TAKE_LOAN') action.score -= 20;
        if (action.action === 'CREATE_BUSINESS') action.score -= 15;
        if (action.action === 'SELL_BUSINESS') action.score += 5; // More willing to cut losses
        if (action.action === 'LAUNCH_CAMPAIGN') action.score -= 10; // Conservative marketing
        break;
      case 'AGGRESSIVE':
        if (action.action === 'TAKE_LOAN') action.score += 15;
        if (action.action === 'CREATE_BUSINESS') action.score += 15;
        if (action.action === 'UPGRADE_BUSINESS') action.score += 10;
        if (action.action === 'LAUNCH_CAMPAIGN') action.score += 15;
        break;
      case 'TRADER':
        if (action.action === 'CHANGE_PRICE') action.score += 20;
        if (action.action === 'BUY_INVENTORY') action.score += 10;
        break;
      case 'EXPANSIONIST':
        if (action.action === 'CREATE_BUSINESS') action.score += 25;
        if (action.action === 'HIRE_EMPLOYEE') action.score += 10;
        if (action.action === 'LAUNCH_CAMPAIGN') action.score += 20; // Marketing drives expansion
        break;
    }
  }

  // ---- Cash Pressure (global modifier) ----
  const cashReserve = ctx.netWorth * config.cashReserveRatio;
  if (ctx.cash < cashReserve * 0.5) {
    // Severe cash pressure: penalize spending actions
    for (const action of actions) {
      if (['BUY_INVENTORY', 'UPGRADE_BUSINESS', 'CREATE_BUSINESS', 'TAKE_LOAN', 'HIRE_EMPLOYEE'].includes(action.action)) {
        action.score -= 30;
      }
    }
  }

  // Always include HOLD as an option
  actions.push({ action: 'HOLD', score: BASE_ACTION_SCORES.HOLD });

  // Sort by score descending
  actions.sort((a, b) => b.score - a.score);

  return actions;
}

/**
 * Select the best action(s) to execute.
 * Returns the top action (or HOLD if no good options).
 */
export function selectBestAction(ctx: AIDecisionContext): ScoredAction {
  const scored = evaluateActions(ctx);

  // Filter out actions with very low scores
  const viable = scored.filter(a => a.score > 0);
  if (viable.length === 0) return { action: 'HOLD', score: 0 };

  // Probabilistic selection among top actions (adds variety)
  // 70% chance of best action, 20% second best, 10% third
  if (viable.length >= 3 && Math.random() < 0.1) return viable[2];
  if (viable.length >= 2 && Math.random() < 0.2) return viable[1];
  return viable[0];
}
