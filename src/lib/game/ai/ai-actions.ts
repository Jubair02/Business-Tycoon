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
    const inventories = await db.inventory.findMany({ where: { businessId } });
    if (inventories.length === 0) return { action: 'CHANGE_PRICE', success: false };

    const productDefs = PRODUCTS[business.type] || [];
    const config = getPersonalityConfig(ctx.personality);

    // Get market prices for the city
    const marketPrices = await db.marketPrice.findMany({ where: { city: business.city } });
    const marketMap = new Map(marketPrices.map(mp => [mp.productName, mp.priceMultiplier]));

    let priceChanges = 0;
    const updates: Promise<unknown>[] = [];

    for (const inv of inventories) {
      const prodDef = productDefs.find(p => p.name === inv.productName);
      if (!prodDef) continue;

      const marketRef = prodDef.basePrice * (1 + prodDef.suggestedMarkup) * (marketMap.get(inv.productName) || 1);
      const stockRatio = inv.quantity / prodDef.maxStock;
      const strategy = selectPricingStrategy(ctx.personality, business.healthScore, stockRatio);
      const newPrice = calculateAIPrice(marketRef, ctx.personality, strategy, business.healthScore, stockRatio);

      // Only update if price changed meaningfully (>5% difference)
      if (Math.abs(newPrice - inv.sellPrice) / inv.sellPrice > 0.05) {
        updates.push(
          db.inventory.update({
            where: { id: inv.id },
            data: { sellPrice: newPrice },
          })
        );
        priceChanges++;
      }
    }

    await Promise.all(updates);

    return {
      action: 'CHANGE_PRICE',
      success: priceChanges > 0,
      message: priceChanges > 0 ? `Adjusted ${priceChanges} prices` : 'No price changes needed',
    };
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

      const player = await tx.player.findUnique({ where: { id: playerId }, select: { cash: true, name: true } });
      if (!player || player.cash < bType.investment * 1.2) {
        return { action: 'CREATE_BUSINESS', success: false, message: 'Cannot afford business' };
      }

      // Pick a city (consider existing presence for diversification)
      const existingCities = ctx.businesses.map(b => b.city);
      const newCities = CITIES.filter(c => !existingCities.includes(c.id));
      const cityPool = newCities.length > 0 ? newCities : CITIES;
      const city = cityPool[Math.floor(Math.random() * cityPool.length)];

      // Create business (same as player logic)
      const businessName = `${bType.name} - ${city.name}`;

      await tx.player.update({
        where: { id: playerId },
        data: { cash: { decrement: bType.investment } },
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
        },
      });

      // Create initial inventory
      const productDefs = PRODUCTS[bType.id] || [];
      const config = getPersonalityConfig(ctx.personality);

      for (const prod of productDefs) {
        const initialStock = Math.floor(prod.maxStock * 0.4);
        const marketRef = prod.basePrice * (1 + prod.suggestedMarkup);
        const sellPrice = calculateAIPrice(marketRef, ctx.personality, config.defaultPricingStrategy, 50, 0.4);

        await tx.inventory.create({
          data: {
            businessId: business.id,
            productId: '',
            productName: prod.name,
            category: prod.category,
            quantity: initialStock,
            purchasePrice: prod.basePrice,
            sellPrice,
          },
        });
      }

      return {
        action: 'CREATE_BUSINESS',
        success: true,
        message: `Opened ${businessName} in ${city.name}`,
        newsWorthy: true,
        newsTitle: `New ${bType.name} Opens`,
        newsContent: `A new ${bType.name} has opened in ${city.name}, adding competition to the local market.`,
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
