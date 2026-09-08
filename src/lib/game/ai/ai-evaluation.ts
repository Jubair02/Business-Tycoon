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

// ---- Action Scoring Weights ----
// Base scores for each action type (before personality modifiers)
const BASE_ACTION_SCORES: Record<AIAction, number> = {
  BUY_INVENTORY: 50,
  CHANGE_PRICE: 30,
  HIRE_EMPLOYEE: 25,
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
  for (const biz of ctx.businesses) {
    // Score based on business performance - if losing money, more incentive to adjust
    const performanceScore = biz.dailyProfit < 0 ? 40 : 10;
    const score = BASE_ACTION_SCORES.CHANGE_PRICE + performanceScore + priceFreqBonus;
    actions.push({
      action: 'CHANGE_PRICE',
      score,
      target: biz.id,
    });
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
  // Always evaluate but adjust score based on expansionEagerness
  const expandFreqBonus = config.expansionEagerness * 10; // Higher eagerness = higher base score
  const existingTypes = new Set(ctx.businesses.map(b => b.type));
  const affordableTypes = BUSINESS_TYPES.filter(b => ctx.cash > b.investment * 1.5);
  const newTypes = affordableTypes.filter(b => !existingTypes.has(b.id));

  for (const bType of newTypes) {
    // Score based on profitability, cash available, diversification
    const diversificationBonus = 20;
    const cashAfter = ctx.cash - bType.investment;
    const cashPressure = cashAfter < ctx.netWorth * config.cashReserveRatio ? -50 : 0;
    const score = BASE_ACTION_SCORES.CREATE_BUSINESS + diversificationBonus + cashPressure + expandFreqBonus;
    actions.push({
      action: 'CREATE_BUSINESS',
      score,
      params: { businessType: bType.id },
    });
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
    const activeCampaigns = (biz as Record<string, unknown>).activeCampaignCount as number || 0;

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
