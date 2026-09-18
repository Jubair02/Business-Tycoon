// ============================================
// Bangladesh Business Tycoon - AI Action Execution
// Phase 2: Execute AI decisions against the database
//
// AI actions go through the SAME validation as player actions.
// AI cannot cheat or bypass rules.
// ============================================

import { db } from '@/lib/db';
import {
  BUSINESS_TYPES, CITIES, PRODUCTS, EMPLOYEE_ROLES,
  getRandomName, getBusinessType, getCity,
} from '@/lib/game-data';
import type { ScoredAction, AIDecisionContext, AIPersonality, AIPricingStrategy } from './types';
import { getPersonalityConfig, calculateAIPrice, selectPricingStrategy } from './ai-strategy';
import { roundTaka } from '@/lib/game/economy/formulas';
import { AI_MARKETING_CONFIG, MARKETING_CHANNELS, type MarketingChannel } from '../marketing/marketing-config';
import { buildStartingInventory, calculateExpansionCost, calculateSetupDays, getRandomLocationForCity, EXPANSION_CONFIG, AI_EXPANSION_CONFIG } from '../expansion';
import { awardExperience, calculateUpgradeXp, PROGRESSION_CONFIG } from '../progression';
import {
  findRivalsInMarket,
  calculateUndercutPrice,
  RIVALRY_CONFIG,
  type PoachTarget,
} from './ai-rivalry';
import { notifyStaffPoached } from '@/lib/push/notifications';

/** Result of executing an AI action */
export interface AIActionResult {
  action: string;
  success: boolean;
  message?: string;
  newsWorthy?: boolean; // Should this generate a news article?
  newsTitle?: string;
  newsContent?: string;
}

/**
 * Execute a scored AI action.
 * All database operations happen within transactions.
 * AI respects the same rules as human players.
 */
export async function executeAIAction(
  playerId: string,
  action: ScoredAction,
  ctx: AIDecisionContext,
): Promise<AIActionResult> {
  switch (action.action) {
    case 'BUY_INVENTORY':
      return executeBuyInventory(playerId, action, ctx);
    case 'CHANGE_PRICE':
      return executeChangePrice(playerId, action, ctx);
    case 'HIRE_EMPLOYEE':
      return executeHireEmployee(playerId, action, ctx);
    case 'POACH_EMPLOYEE':
      return executePoachEmployee(playerId, action, ctx);
    case 'UPGRADE_BUSINESS':
      return executeUpgradeBusiness(playerId, action, ctx);
    case 'CREATE_BUSINESS':
      return executeCreateBusiness(playerId, action, ctx);
    case 'SELL_BUSINESS':
      return executeSellBusiness(playerId, action, ctx);
    case 'TAKE_LOAN':
      return executeTakeLoan(playerId, action, ctx);
    case 'REPAY_LOAN':
      return executeRepayLoan(playerId, action, ctx);
    case 'LAUNCH_CAMPAIGN':
      return executeLaunchCampaign(playerId, action, ctx);
    case 'HOLD':
    default:
      return { action: 'HOLD', success: true };
  }
}

// ---- BUY_INVENTORY ----
async function executeBuyInventory(
  playerId: string,
  action: ScoredAction,
  ctx: AIDecisionContext,
): Promise<AIActionResult> {
  const businessId = action.target;
  if (!businessId) return { action: 'BUY_INVENTORY', success: false };

  const business = ctx.businesses.find(b => b.id === businessId);
  if (!business) return { action: 'BUY_INVENTORY', success: false };

  const config = getPersonalityConfig(ctx.personality);

  try {
    return await db.$transaction(async (tx) => {
      // Verify player still has enough cash
      const player = await tx.player.findUnique({ where: { id: playerId }, select: { cash: true } });
      if (!player) return { action: 'BUY_INVENTORY', success: false };

      // Find inventory items that need restocking
      const inventories = await tx.inventory.findMany({
        where: { businessId },
      });

      const productDefs = PRODUCTS[business.type] || [];
      let totalSpent = 0;
      let itemsBought = 0;

      for (const inv of inventories) {
        const prodDef = productDefs.find(p => p.name === inv.productName);
        if (!prodDef) continue;

        const stockRatio = inv.quantity / prodDef.maxStock;
        if (stockRatio >= config.inventoryBuyThreshold) continue; // Already have enough

        // Calculate how much to buy
        const targetStock = Math.floor(prodDef.maxStock * (config.inventoryBuyThreshold + 0.2));
        const needed = targetStock - inv.quantity;
        if (needed <= 0) continue;

        // Cost: basePrice is the wholesale/purchase price (before markup)
        const costPerUnit = prodDef.basePrice;
        const cost = costPerUnit * needed;

        // Check if we can afford it
        if (player.cash - totalSpent < cost) continue;

        // Buy inventory
        await tx.inventory.update({
          where: { id: inv.id },
          data: {
            quantity: { increment: needed },
            purchasePrice: costPerUnit, // Update to current market cost
          },
        });

        totalSpent += cost;
        itemsBought += needed;
      }

      // Also check if there are products with NO inventory yet (new business)
      if (inventories.length < productDefs.length) {
        const existingProducts = new Set(inventories.map(i => i.productName));
        const missingProducts = productDefs.filter(p => !existingProducts.has(p.name));

        for (const prod of missingProducts) {
          const initialStock = Math.floor(prod.maxStock * 0.5);
          const cost = prod.basePrice * initialStock;
          if (player.cash - totalSpent < cost) continue;

          // Calculate sell price using AI pricing
          const marketRef = prod.basePrice * (1 + prod.suggestedMarkup);
          const sellPrice = calculateAIPrice(marketRef, ctx.personality, config.defaultPricingStrategy, 50, 0.5);

          await tx.inventory.create({
            data: {
              businessId,
              productId: '', // Not used for linking
              productName: prod.name,
              category: prod.category,
              quantity: initialStock,
              purchasePrice: prod.basePrice,
              sellPrice,
            },
          });

          totalSpent += cost;
          itemsBought += initialStock;
        }
      }

      if (totalSpent > 0) {
        // Deduct from player cash
        await tx.player.update({
          where: { id: playerId },
          data: { cash: { decrement: roundTaka(totalSpent) } },
        });
      }

      return {
        action: 'BUY_INVENTORY',
        success: itemsBought > 0,
        message: itemsBought > 0 ? `Bought ${itemsBought} items for ৳${roundTaka(totalSpent).toLocaleString()}` : 'No items needed',
      };
    });
  } catch (err) {
    console.error('[AI] BUY_INVENTORY failed:', err);
    return { action: 'BUY_INVENTORY', success: false };
  }
}

// ---- CHANGE_PRICE ----
async function executeChangePrice(
  playerId: string,
  action: ScoredAction,
  ctx: AIDecisionContext,
): Promise<AIActionResult> {
  const businessId = action.target;
  if (!businessId) return { action: 'CHANGE_PRICE', success: false };

  const business = ctx.businesses.find(b => b.id === businessId);
  if (!business) return { action: 'CHANGE_PRICE', success: false };

  try {
    return await db.$transaction(async (tx) => {
      const inventories = await tx.inventory.findMany({ where: { businessId } });
      if (inventories.length === 0) return { action: 'CHANGE_PRICE', success: false };

      const productDefs = PRODUCTS[business.type] || [];
      const config = getPersonalityConfig(ctx.personality);

      // Get market prices for the city
      const marketPrices = await tx.marketPrice.findMany({ where: { city: business.city } });
      const marketMap = new Map(marketPrices.map(mp => [mp.productName, mp.priceMultiplier]));

      // What the human competition on this street is charging, per product.
      // This is the input the strategy layer never had: without it the AI
      // priced against an abstract market reference and never against the
      // player standing next to it.
      const rivals = findRivalsInMarket(ctx.rivals, business.city, business.type);

      let priceChanges = 0;
      let undercuts = 0;

      for (const inv of inventories) {
        const prodDef = productDefs.find(p => p.name === inv.productName);
        if (!prodDef) continue;

        const marketRef = prodDef.basePrice * (1 + prodDef.suggestedMarkup) * (marketMap.get(inv.productName) || 1);
        const stockRatio = inv.quantity / prodDef.maxStock;
        const strategy = selectPricingStrategy(ctx.personality, business.healthScore, stockRatio);
        let newPrice = calculateAIPrice(marketRef, ctx.personality, strategy, business.healthScore, stockRatio);

        // Undercut the cheapest human rival selling the same thing here.
        const rivalPrice = Math.min(
          ...rivals.map(r => r.priceIndex * marketRef),
          Number.POSITIVE_INFINITY,
        );
        if (Number.isFinite(rivalPrice)) {
          const undercutPrice = calculateUndercutPrice({
            intendedPrice: newPrice,
            rivalPrice,
            purchasePrice: inv.purchasePrice,
            personality: ctx.personality,
          });
          if (undercutPrice !== null) {
            newPrice = undercutPrice;
            undercuts++;
          }
        }

        // Only update if price changed meaningfully (>5% difference)
        if (Math.abs(newPrice - inv.sellPrice) / inv.sellPrice > 0.05) {
          await tx.inventory.update({
            where: { id: inv.id },
            data: { sellPrice: newPrice },
          });
          priceChanges++;
        }
      }

      return {
        action: 'CHANGE_PRICE',
        success: priceChanges > 0,
        message: priceChanges > 0
          ? `Adjusted ${priceChanges} prices${undercuts > 0 ? ` (${undercuts} undercutting a rival)` : ''}`
          : 'No price changes needed',
        newsWorthy: undercuts >= 3,
        newsTitle: undercuts >= 3 ? 'Price war on the high street' : undefined,
        newsContent: undercuts >= 3
          ? `${business.name} has cut prices across ${undercuts} lines to undercut rivals in ${business.city}. Shoppers are expected to follow the discounts.`
          : undefined,
      };
    });
  } catch (err) {
    console.error('[AI] CHANGE_PRICE failed:', err);
    return { action: 'CHANGE_PRICE', success: false };
  }
}

// ---- HIRE_EMPLOYEE ----
async function executeHireEmployee(
  playerId: string,
  action: ScoredAction,
  ctx: AIDecisionContext,
): Promise<AIActionResult> {
  const businessId = action.target;
  if (!businessId) return { action: 'HIRE_EMPLOYEE', success: false };

  try {
    return await db.$transaction(async (tx) => {
      const business = await tx.business.findUnique({
        where: { id: businessId },
        include: { employees: true },
      });
      if (!business || business.employees.length >= 5) {
        return { action: 'HIRE_EMPLOYEE', success: false, message: 'Max employees reached' };
      }

      const player = await tx.player.findUnique({ where: { id: playerId }, select: { cash: true } });
      if (!player) return { action: 'HIRE_EMPLOYEE', success: false };

      // Determine which role to hire (prefer SALESPERSON then CASHIER for AI)
      const existingRoles = new Set(business.employees.map(e => e.role));
      const hirePriority = ['SALESPERSON', 'CASHIER', 'MANAGER', 'CLEANER', 'DELIVERY_RIDER'];
      const roleToHire = hirePriority.find(r => !existingRoles.has(r)) || 'CASHIER';
      const roleDef = EMPLOYEE_ROLES.find(r => r.role === roleToHire);
      if (!roleDef) return { action: 'HIRE_EMPLOYEE', success: false };

      // Check if can afford 30 days of salary
      if (player.cash < roleDef.baseSalary * 2) {
        return { action: 'HIRE_EMPLOYEE', success: false, message: 'Cannot afford salary' };
      }

      // Hire employee (same as player logic)
      const skill = 3 + Math.random() * 7; // 3-10
      const efficiency = 0.5 + Math.random() * 0.5; // 0.5-1.0

      await tx.employee.create({
        data: {
          businessId,
          role: roleDef.role,
          name: getRandomName(),
          salary: roleDef.baseSalary,
          skill: roundTaka(skill * 10) / 10,
          efficiency: roundTaka(efficiency * 100) / 100,
        },
      });

      return {
        action: 'HIRE_EMPLOYEE',
        success: true,
        message: `Hired ${roleDef.label}`,
        newsWorthy: roleDef.role === 'MANAGER',
      };
    });
  } catch (err) {
    console.error('[AI] HIRE_EMPLOYEE failed:', err);
    return { action: 'HIRE_EMPLOYEE', success: false };
  }
}

// ---- POACH_EMPLOYEE ----
//
// Headhunt a hand off a human rival trading in the same market. The employee
// moves rather than being cloned: the player genuinely loses them, which is the
// point — it is the one AI action the player feels immediately.
//
// The player is told, in their own log, who took whom and for how much, because
// a loss the player cannot see is just an unexplained drop in service quality.
async function executePoachEmployee(
  playerId: string,
  action: ScoredAction,
  ctx: AIDecisionContext,
): Promise<AIActionResult> {
  const businessId = action.target;
  const target = action.params?.poach as PoachTarget | undefined;
  if (!businessId || !target) return { action: 'POACH_EMPLOYEE', success: false };

  try {
    return await db.$transaction(async (tx) => {
      const business = await tx.business.findUnique({
        where: { id: businessId },
        include: { employees: true },
      });
      if (!business || business.employees.length >= 5) {
        return { action: 'POACH_EMPLOYEE', success: false, message: 'Max employees reached' };
      }

      // Re-read the employee inside the transaction: they may have been fired,
      // or poached by another AI, since the context was built.
      const employee = await tx.employee.findUnique({ where: { id: target.employeeId } });
      if (!employee || employee.businessId !== target.fromBusinessId) {
        return { action: 'POACH_EMPLOYEE', success: false, message: 'Target no longer available' };
      }

      const player = await tx.player.findUnique({
        where: { id: playerId },
        select: { cash: true, name: true },
      });
      if (!player) return { action: 'POACH_EMPLOYEE', success: false };

      const offeredSalary = Math.round(employee.salary * (1 + RIVALRY_CONFIG.poachPremium));
      // Same affordability bar the evaluator used, re-checked against live cash.
      if (player.cash < (offeredSalary / 30) * RIVALRY_CONFIG.poachCashCoverDays) {
        return { action: 'POACH_EMPLOYEE', success: false, message: 'Cannot afford the offer' };
      }

      // The move itself: one employee, one new employer, one better wage.
      await tx.employee.update({
        where: { id: employee.id },
        data: { businessId, salary: offeredSalary },
      });

      await tx.player.update({
        where: { id: playerId },
        data: { lastPoachAt: ctx.gameDay },
      });

      // Tell the player. This is the only way they find out.
      await tx.gameLog.create({
        data: {
          playerId: target.fromPlayerId,
          businessId: target.fromBusinessId,
          type: 'EMPLOYEE_POACHED',
          message:
            `${employee.name} (${employee.role.toLowerCase().replace(/_/g, ' ')}) has left ` +
            `${target.fromBusinessName} for ${business.name}, who offered ` +
            `৳${offeredSalary.toLocaleString()} a month — ` +
            `৳${(offeredSalary - employee.salary).toLocaleString()} more than you were paying.`,
        },
      });

      // The player loses a real employee here, so they are told out of band as
      // well as in their log — a silent loss reads as an unexplained drop in
      // service quality.
      const victim = await tx.player.findUnique({
        where: { id: target.fromPlayerId },
        select: { userId: true },
      });
      if (victim?.userId) {
        void notifyStaffPoached(
          victim.userId,
          employee.name,
          target.fromBusinessName,
          business.name,
        ).catch(() => {});
      }

      return {
        action: 'POACH_EMPLOYEE',
        success: true,
        message: `Poached ${employee.name} from ${target.fromBusinessName}`,
        newsWorthy: true,
        newsTitle: 'Staff poached in a hiring raid',
        newsContent:
          `${business.name} has hired ${employee.name} away from ${target.fromBusinessName} ` +
          `with a ৳${offeredSalary.toLocaleString()} monthly offer. Wage competition in ` +
          `${business.city} is heating up.`,
      };
    });
  } catch (err) {
    console.error('[AI] POACH_EMPLOYEE failed:', err);
    return { action: 'POACH_EMPLOYEE', success: false };
  }
}

// ---- UPGRADE_BUSINESS ----
async function executeUpgradeBusiness(
  playerId: string,
  action: ScoredAction,
  ctx: AIDecisionContext,
): Promise<AIActionResult> {
  const businessId = action.target;
  if (!businessId) return { action: 'UPGRADE_BUSINESS', success: false };

  try {
    return await db.$transaction(async (tx) => {
      const business = await tx.business.findUnique({ where: { id: businessId } });
      if (!business || business.level >= 10) {
        return { action: 'UPGRADE_BUSINESS', success: false };
      }

      const bType = getBusinessType(business.type);
      if (!bType) return { action: 'UPGRADE_BUSINESS', success: false };

      const upgradeCost = Math.round(bType.investment * business.level * 0.5);
      const player = await tx.player.findUnique({ where: { id: playerId }, select: { cash: true } });
      if (!player || player.cash < upgradeCost) {
        return { action: 'UPGRADE_BUSINESS', success: false, message: 'Cannot afford upgrade' };
      }

      // Upgrade (same as player logic)
      await tx.player.update({
        where: { id: playerId },
        data: { cash: { decrement: upgradeCost } },
      });

      await tx.business.update({
        where: { id: businessId },
        data: { level: { increment: 1 } },
      });

      // Phase 6: same upgrade XP the player route awards.
      await awardExperience(
        tx,
        playerId,
        calculateUpgradeXp(business.level + 1),
        'BUSINESS_UPGRADE',
        businessId,
      );

      return {
        action: 'UPGRADE_BUSINESS',
        success: true,
        message: `Upgraded to Level ${business.level + 1}`,
        newsWorthy: true,
        newsTitle: `${bType.name} Upgraded`,
        newsContent: `A ${bType.name} has been upgraded to Level ${business.level + 1}.`,
      };
    });
  } catch (err) {
    console.error('[AI] UPGRADE_BUSINESS failed:', err);
    return { action: 'UPGRADE_BUSINESS', success: false };
  }
}

// ---- CREATE_BUSINESS ----
async function executeCreateBusiness(
  playerId: string,
  action: ScoredAction,
  ctx: AIDecisionContext,
): Promise<AIActionResult> {
  const businessType = action.params?.businessType as string | undefined;
  if (!businessType) return { action: 'CREATE_BUSINESS', success: false };

  try {
    return await db.$transaction(async (tx) => {
      const bType = getBusinessType(businessType);
      if (!bType) return { action: 'CREATE_BUSINESS', success: false };

      const player = await tx.player.findUnique({ where: { id: playerId }, select: { cash: true, name: true, expansionCount: true } });
      if (!player) return { action: 'CREATE_BUSINESS', success: false, message: 'Player not found' };

      // Phase 5: Check expansion limits
      const currentBusinessCount = ctx.businesses.length;
      const maxBusinesses = Math.min(EXPANSION_CONFIG.maxBusinessesPerPlayer, AI_EXPANSION_CONFIG.maxAIBusinesses);
      if (currentBusinessCount >= maxBusinesses) {
        return { action: 'CREATE_BUSINESS', success: false, message: 'Max businesses reached' };
      }

      // Phase 5: Check expansion cooldown
      const daysSinceExpansion = ctx.gameDay - ctx.lastExpansionAt;
      if (ctx.lastExpansionAt > 0 && daysSinceExpansion < EXPANSION_CONFIG.expansionCooldownDays) {
        return { action: 'CREATE_BUSINESS', success: false, message: 'Expansion cooldown active' };
      }

      // Pick a city. If the evaluator singled out a market a human player is
      // making money in, open there — that is the "open nearby" reaction. Left
      // to itself the AI diversifies away from its own existing cities, which
      // is what it always did.
      const targetCity = action.params?.targetCity as string | null | undefined;
      const targetedCity = targetCity ? CITIES.find(c => c.id === targetCity) : undefined;

      const existingCities = ctx.businesses.map(b => b.city);
      const newCities = CITIES.filter(c => !existingCities.includes(c.id));
      const cityPool = newCities.length > 0 ? newCities : CITIES;
      const city = targetedCity ?? cityPool[Math.floor(Math.random() * cityPool.length)];

      // Phase 5: Pick a location within the city
      const location = getRandomLocationForCity(city.id);
      const locationId = location?.id || null;

      // Phase 5: Calculate expansion cost with scaling
      const costInfo = calculateExpansionCost(bType.investment, currentBusinessCount, locationId || '', bType.id);

      // Phase 5: Check affordability with personality-specific reserve
      const personalityReserve = AI_EXPANSION_CONFIG.aiCashReserveAfterExpansion[ctx.personality] ?? 0.2;
      const minReserve = ctx.netWorth * personalityReserve;
      if (player.cash < costInfo.totalCost + minReserve) {
        return { action: 'CREATE_BUSINESS', success: false, message: 'Cannot afford expansion with reserve' };
      }

      // Phase 5: Calculate setup days
      const setupDays = calculateSetupDays(bType.investment);

      // Create business (same as player logic, with Phase 5 expansion fields)
      const businessName = `${bType.name} - ${city.name}`;

      await tx.player.update({
        where: { id: playerId },
        data: {
          cash: { decrement: costInfo.totalCost },
          expansionCount: { increment: 1 },
          lastExpansionAt: ctx.gameDay,
        },
      });

      const business = await tx.business.create({
        data: {
          playerId,
          type: bType.id,
          city: city.id,
          name: businessName,
          level: 1,
          reputation: 50,
          cash: 0,
          // Phase 5: Expansion fields
          location: locationId,
          setupDaysRemaining: setupDays,
        },
      });

      // Opening stock. Already paid for via costInfo.totalCost, which prices
      // it in — the AI buys its shelves on the same terms as the player.
      // Only the shelf price differs, which personality decides.
      const config = getPersonalityConfig(ctx.personality);
      const startingInventory = buildStartingInventory(bType.id);

      for (const item of startingInventory.items) {
        // `sellPrice` from the helper is the typical retail price
        // (base x suggested markup) — the reference the AI prices against.
        const sellPrice = calculateAIPrice(
          item.sellPrice,
          ctx.personality,
          config.defaultPricingStrategy,
          50,
          EXPANSION_CONFIG.startingStockRatio,
        );

        await tx.inventory.create({
          data: {
            businessId: business.id,
            productId: '',
            productName: item.productName,
            category: item.category,
            quantity: item.quantity,
            purchasePrice: item.purchasePrice,
            sellPrice,
          },
        });
      }

      // Phase 6: AI progresses on the same XP rules as the player.
      await awardExperience(
        tx,
        playerId,
        PROGRESSION_CONFIG.newBusinessXp,
        'NEW_BUSINESS',
        business.id,
      );

      return {
        action: 'CREATE_BUSINESS',
        success: true,
        message: `Opened ${businessName} in ${city.name}${location ? ` (${location.name})` : ''}`,
        newsWorthy: true,
        newsTitle: `New ${bType.name} Opens`,
        newsContent: `A new ${bType.name} has opened in ${city.name}${location ? ` at ${location.name}` : ''}, adding competition to the local market.`,
      };
    });
  } catch (err) {
    console.error('[AI] CREATE_BUSINESS failed:', err);
    return { action: 'CREATE_BUSINESS', success: false };
  }
}

// ---- SELL_BUSINESS ----
async function executeSellBusiness(
  playerId: string,
  action: ScoredAction,
  ctx: AIDecisionContext,
): Promise<AIActionResult> {
  const businessId = action.target;
  if (!businessId) return { action: 'SELL_BUSINESS', success: false };

  try {
    return await db.$transaction(async (tx) => {
      const business = await tx.business.findUnique({
        where: { id: businessId },
        include: { inventories: true },
      });
      if (!business) return { action: 'SELL_BUSINESS', success: false };

      const bType = getBusinessType(business.type);
      if (!bType) return { action: 'SELL_BUSINESS', success: false };

      // Sell price = 40% of investment + inventory value
      const inventoryValue = business.inventories.reduce((sum, inv) => sum + inv.quantity * inv.purchasePrice, 0);
      const sellPrice = Math.round(bType.investment * 0.4 + inventoryValue * 0.5);

      // Give cash to player
      await tx.player.update({
        where: { id: playerId },
        data: { cash: { increment: sellPrice } },
      });

      // Delete business (cascades to inventory, employees, etc.)
      await tx.business.delete({ where: { id: businessId } });

      return {
        action: 'SELL_BUSINESS',
        success: true,
        message: `Sold ${business.name} for ৳${sellPrice.toLocaleString()}`,
        newsWorthy: true,
        newsTitle: `Business Sold`,
        newsContent: `A ${bType.name} in the market has been sold off by its owner.`,
      };
    });
  } catch (err) {
    console.error('[AI] SELL_BUSINESS failed:', err);
    return { action: 'SELL_BUSINESS', success: false };
  }
}

// ---- LAUNCH_CAMPAIGN ----
async function executeLaunchCampaign(
  playerId: string,
  action: ScoredAction,
  ctx: AIDecisionContext,
): Promise<AIActionResult> {
  const businessId = action.target;
  if (!businessId) return { action: 'LAUNCH_CAMPAIGN', success: false };

  const business = ctx.businesses.find(b => b.id === businessId);
  if (!business) return { action: 'LAUNCH_CAMPAIGN', success: false };

  try {
    return await db.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id: playerId }, select: { cash: true } });
      if (!player) return { action: 'LAUNCH_CAMPAIGN', success: false };

      // Pick channel based on personality preferences
      const preferredChannels = AI_MARKETING_CONFIG.personalityPreferredChannels[ctx.personality] || ['SOCIAL_MEDIA'];
      const availableChannels = preferredChannels.filter(ch => {
        const chConfig = MARKETING_CHANNELS[ch as MarketingChannel];
        return chConfig && business.level >= chConfig.minLevel && chConfig.aiAvailable;
      });

      if (availableChannels.length === 0) {
        return { action: 'LAUNCH_CAMPAIGN', success: false, message: 'No available channels' };
      }

      // Pick a random channel from available preferred channels
      const channel = availableChannels[Math.floor(Math.random() * availableChannels.length)] as MarketingChannel;
      const channelConfig = MARKETING_CHANNELS[channel];

      // Calculate budget
      const budget = Math.max(
        channelConfig.baseDailyCost,
        Math.round(AI_MARKETING_CONFIG.aiBudgetRevenueFraction * Math.max(business.dailyRevenue, 10000))
      );

      // Check if budget is affordable
      if (budget > player.cash * 0.2) {
        return { action: 'LAUNCH_CAMPAIGN', success: false, message: 'Cannot afford campaign' };
      }

      // Pick duration: 5-14 days randomly
      const duration = 5 + Math.floor(Math.random() * 10);
      const totalBudget = budget * duration;

      // Count existing active campaigns for this business
      const activeCount = await tx.marketingCampaign.count({
        where: { businessId, status: 'ACTIVE' },
      });
      if (activeCount >= AI_MARKETING_CONFIG.maxAICampaigns) {
        return { action: 'LAUNCH_CAMPAIGN', success: false, message: 'Max campaigns reached' };
      }

      // Get current game day from context
      const gameDay = ctx.gameDay;

      // Create campaign (consistent with player API: daysRun=1, totalSpend=budget for first day)
      await tx.marketingCampaign.create({
        data: {
          businessId,
          playerId,
          name: `${channelConfig.name} Campaign`,
          channel,
          targetSegment: null, // AI doesn't target segments
          dailyBudget: budget,
          totalBudget,
          duration,
          startDay: gameDay,
          endDay: gameDay + duration,
          status: 'ACTIVE',
          daysRun: 1,
          totalSpend: budget,
        },
      });

      // Deduct first day's budget from player cash
      await tx.player.update({
        where: { id: playerId },
        data: { cash: { decrement: budget } },
      });

      return {
        action: 'LAUNCH_CAMPAIGN',
        success: true,
        message: `Launched ${channelConfig.name} campaign (৳${budget.toLocaleString()}/day, ${duration} days)`,
        newsWorthy: channel === 'INFLUENCER' || channel === 'TV_MEDIA',
        newsTitle: `Marketing Campaign Launched`,
        newsContent: `A new ${channelConfig.name} marketing campaign has been launched.`,
      };
    });
  } catch (err) {
    console.error('[AI] LAUNCH_CAMPAIGN failed:', err);
    return { action: 'LAUNCH_CAMPAIGN', success: false };
  }
}

// ---- TAKE_LOAN ----
async function executeTakeLoan(
  playerId: string,
  action: ScoredAction,
  ctx: AIDecisionContext,
): Promise<AIActionResult> {
  try {
    return await db.$transaction(async (tx) => {
      // Count existing active loans
      const activeLoans = await tx.loan.count({
        where: { playerId, status: 'ACTIVE' },
      });
      if (activeLoans >= 2) return { action: 'TAKE_LOAN', success: false, message: 'Max loans reached' };

      const player = await tx.player.findUnique({ where: { id: playerId }, select: { cash: true, netWorth: true } });
      if (!player) return { action: 'TAKE_LOAN', success: false };

      // Loan amount: 30-60% of net worth, capped at 2M
      const loanAmount = Math.min(
        roundTaka(player.netWorth * (0.3 + Math.random() * 0.3)),
        2000000,
      );
      if (loanAmount < 100000) return { action: 'TAKE_LOAN', success: false, message: 'Loan too small' };

      const interestRate = 0.05 + Math.random() * 0.03; // 5-8%
      const durationDays = 30 + Math.floor(Math.random() * 30); // 30-60 days
      const totalOwed = roundTaka(loanAmount * (1 + interestRate));
      const dailyPayment = roundTaka(totalOwed / durationDays);

      await tx.loan.create({
        data: {
          playerId,
          amount: loanAmount,
          interestRate,
          remainingDebt: totalOwed,
          dailyPayment,
          daysRemaining: durationDays,
          totalInterest: roundTaka(totalOwed - loanAmount),
          status: 'ACTIVE',
        },
      });

      await tx.player.update({
        where: { id: playerId },
        data: { cash: { increment: loanAmount } },
      });

      return {
        action: 'TAKE_LOAN',
        success: true,
        message: `Took loan of ৳${loanAmount.toLocaleString()}`,
      };
    });
  } catch (err) {
    console.error('[AI] TAKE_LOAN failed:', err);
    return { action: 'TAKE_LOAN', success: false };
  }
}

// ---- REPAY_LOAN ----
async function executeRepayLoan(
  playerId: string,
  action: ScoredAction,
  ctx: AIDecisionContext,
): Promise<AIActionResult> {
  const loanId = action.target;
  if (!loanId) return { action: 'REPAY_LOAN', success: false };

  try {
    return await db.$transaction(async (tx) => {
      const loan = await tx.loan.findUnique({ where: { id: loanId } });
      if (!loan || loan.status !== 'ACTIVE') return { action: 'REPAY_LOAN', success: false };

      const player = await tx.player.findUnique({ where: { id: playerId }, select: { cash: true } });
      if (!player) return { action: 'REPAY_LOAN', success: false };

      // Repay as much as possible
      const repayment = Math.min(loan.remainingDebt, Math.max(0, player.cash * 0.5)); // Use at most 50% of cash
      if (repayment < loan.dailyPayment) return { action: 'REPAY_LOAN', success: false, message: 'Cannot afford repayment' };

      const newRemaining = Math.max(0, loan.remainingDebt - repayment);

      await tx.loan.update({
        where: { id: loanId },
        data: {
          remainingDebt: newRemaining,
          status: newRemaining <= 0 ? 'PAID_OFF' : 'ACTIVE',
        },
      });

      await tx.player.update({
        where: { id: playerId },
        data: { cash: { decrement: roundTaka(repayment) } },
      });

      return {
        action: 'REPAY_LOAN',
        success: true,
        message: newRemaining <= 0 ? 'Loan fully repaid' : `Repaid ৳${roundTaka(repayment).toLocaleString()}`,
      };
    });
  } catch (err) {
    console.error('[AI] REPAY_LOAN failed:', err);
    return { action: 'REPAY_LOAN', success: false };
  }
}
