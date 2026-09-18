// ============================================
// Bangladesh Business Tycoon - AI Simulation Test
// Deterministic multi-day simulation WITHOUT database
//
// Tests AI behavior over 100 game days to:
// - Verify per-personality balance
// - Detect infinite growth / bankruptcy patterns
// - Ensure no single personality dominates
//
// ⚠️  DEVELOPER WARNING — THIS IS NOT THE REAL GAME ENGINE
// ⚠️  This simulation is a simplified approximation for rapid
// ⚠️  iteration and sanity-checking. It does NOT fully reproduce
// ⚠️  the real tick pipeline (game-engine.ts). DO NOT use this
// ⚠️  as the sole source of truth for balance decisions.
// ⚠️  Use full-engine integration test results for final tuning.
//
// ---- Known Differences from Real Engine ----
//
// 1. EVENTS: No game events are generated or applied.
//    eventCustomerEffect=0, eventDemandEffect=0, activeEvents=[].
//    Real engine: events affect customer counts, demand, and market prices.
//
// 2. MARKET PRICES: No per-city market price multipliers or retention-based
//    updates. Real engine: MarketPrice table updated every 3 ticks with
//    retention blending and event effects.
//
// 3. PRODUCT SALES: Uses individual formula calls (calculateProductDemand,
//    calculatePriceDemandMultiplier, etc.) instead of simulateProductSales()
//    which is the unified pipeline used by the real engine. The unified
//    function adds random variation/volatility per product per day.
//
// 4. TICK ORDER: Real engine order is:
//    Expire events → Update game state → Generate events → Update market prices
//    → Simulate ALL businesses → Process loans → AI tick → Generate news
//    Simulation order (per-player):
//    Simulate businesses → Process loans → Mandatory restock → AI decision
//
// 5. REPUTATION: Uses simplified reputation update (profitable +0.5,
//    unprofitable -0.8, stockout penalty, decay). Real engine uses
//    calculateReputationChange() which includes manager/cleaner skill bonuses.
//
// 6. BUSINESS METRICS: No BusinessMetric recording. Real engine records
//    daily metrics per business for trend analysis.
//
// 7. MARKET SHARE: No market share calculation. Real engine computes
//    attractiveness scores and share percentages per city+type.
//
// 8. AI ACTIONS: In-memory execution is simplified. Real engine uses
//    executeAIAction() with database transactions and full validation.
//
// 9. DETERMINISM: PARTIAL, despite the SeededRNG below. The seed governs the
//    AI's own choices — which business to open, which product to reprice — but
//    the economy formulas this harness calls (`calculatePotentialCustomers`,
//    `calculateProductDemand`) use `Math.random()` internally for their
//    volatility layers, and are shared with the real engine. So runs are
//    reproducible in structure and NOT in exact figures.
//
//    Measured over 12 runs: the bankruptcy count was identical every time (3),
//    while the net-worth coefficient of variation moved between 1.12 and 1.35.
//    Assert accordingly — structure hard, magnitudes with headroom. This
//    comment previously claimed plain "reproducibility", which was wrong and
//    would have produced a flaky test for whoever trusted it.
//
// 10. NO HUMAN PLAYERS: Only AI players are simulated. Real engine
//     includes human player businesses in the same economy.
//
// 11. NO CONCURRENCY: No tick lock, stale recovery, or transaction safety.
//
// 12. CASH FLOOR: Has artificial floor at -1,000,000 ৳ to prevent
//     runaway negative values. Real engine has no such floor.
// ============================================

import type {
  AIPersonality,
  AIDecisionContext,
  ScoredAction,
  AIBusinessSnapshot,
  AIInventorySnapshot,
  AILoanSnapshot,
} from './types';
import { evaluateActions, selectBestAction } from './ai-evaluation';
import { getPersonalityConfig, calculateAIPrice, selectPricingStrategy } from './ai-strategy';
import { EMPTY_RIVAL_INTEL } from './ai-rivalry';
import { BUSINESS_TYPES, CITIES, PRODUCTS, EMPLOYEE_ROLES } from '@/lib/game-data';
import type { ProductDef } from '@/lib/game-data';
import {
  calculatePotentialCustomers,
  calculatePriceDemandMultiplier,
  calculateProductDemand,
  calculateItemsSold,
  calculateRevenue,
  calculateCostOfGoodsSold,
  calculateBusinessExpenses,
  calculateNetProfit,
  calculateBusinessHealth,
  roundTaka,
} from '@/lib/game/economy/formulas';
import { getBusinessEconomyConfig } from '@/lib/game/economy/business-config';
import { getProductDemandConfig } from '@/lib/game/economy/product-demand';
import { ECONOMY_CONFIG } from '@/lib/game/economy/economy-config';

// ---- Seeded PRNG (deterministic) ----
class SeededRNG {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  /** Mulberry32 PRNG */
  next(): number {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Random float in [0, 1) */
  random(): number {
    return this.next();
  }
  /** Random int in [min, max) */
  randInt(min: number, max: number): number {
    return min + Math.floor(this.random() * (max - min));
  }
  /** Random float in [min, max) */
  randFloat(min: number, max: number): number {
    return min + this.random() * (max - min);
  }
  /** Pick random element from array */
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.random() * arr.length)];
  }
}

// ---- In-Memory State Types ----
interface SimInventory {
  id: string;
  productName: string;
  category: string;
  quantity: number;
  maxStock: number;
  purchasePrice: number;
  sellPrice: number;
}

interface SimEmployee {
  role: string;
  salary: number;
  skill: number;
  efficiency: number;
}

export interface SimBusiness {
  id: string;
  type: string;
  city: string;
  name: string;
  level: number;
  reputation: number;
  cash: number;
  dailyRevenue: number;
  dailyExpense: number;
  dailyProfit: number;
  totalProfit: number;
  healthScore: number;
  inventories: SimInventory[];
  employees: SimEmployee[];
}

interface SimLoan {
  id: string;
  amount: number;
  remainingDebt: number;
  dailyPayment: number;
  daysRemaining: number;
  interestRate: number;
}

export interface SimPlayer {
  id: string;
  name: string;
  personality: AIPersonality;
  cash: number;
  netWorth: number;
  businesses: SimBusiness[];
  loans: SimLoan[];
  lastActionAt: number;
}

// ---- Metrics Tracking ----
export interface DayMetrics {
  day: number;
  playerNetWorth: Record<string, number>;
  playerCash: Record<string, number>;
  playerDailyProfit: Record<string, number>;
  playerBusinessCount: Record<string, number>;
  playerLoanCount: Record<string, number>;
  playerInventoryAvg: Record<string, number>;
}

// ---- Create 8 AI Players (matching seedAIPlayers) ----
function createAIPlayers(rng: SeededRNG): SimPlayer[] {
  const definitions = [
    { name: 'Rahim Enterprises', personality: 'CONSERVATIVE' as AIPersonality },
    { name: 'Fatima Holdings', personality: 'AGGRESSIVE' as AIPersonality },
    { name: 'Khan & Sons', personality: 'BALANCED' as AIPersonality },
    { name: 'Chowdhury Corp', personality: 'TRADER' as AIPersonality },
    { name: 'Sylhet Trading Co', personality: 'EXPANSIONIST' as AIPersonality },
    { name: 'Dhaka Business Group', personality: 'BALANCED' as AIPersonality },
    { name: 'Bengal Ventures', personality: 'AGGRESSIVE' as AIPersonality },
    { name: 'Padma Industries', personality: 'CONSERVATIVE' as AIPersonality },
  ];

  const players: SimPlayer[] = [];
  let nextId = 1;

  for (const def of definitions) {
    const baseCash = 600000 + rng.random() * 600000;
    const player: SimPlayer = {
      id: `player-${nextId++}`,
      name: def.name,
      personality: def.personality,
      cash: baseCash,
      netWorth: baseCash,
      businesses: [],
      loans: [],
      lastActionAt: 0,
    };

    // Each AI starts with 1-2 businesses
    const numBusinesses = def.personality === 'EXPANSIONIST' ? 2 : 1;
    const usedTypes = new Set<string>();

    for (let i = 0; i < numBusinesses; i++) {
      let bType: typeof BUSINESS_TYPES[number] | undefined;

      if (i === 0) {
        // First business: prefer cheaper, stable types (TEA_STALL, GROCERY)
        const starterTypes = BUSINESS_TYPES.filter(b => b.investment <= 300000);
        bType = starterTypes.length > 0
          ? rng.pick(starterTypes)
          : BUSINESS_TYPES[0]; // fallback
      } else {
        // Second business (EXPANSIONIST only): any affordable type keeping 200K cash reserve
        const affordableTypes = BUSINESS_TYPES.filter(b => !usedTypes.has(b.id) && player.cash > b.investment + 200000);
        if (affordableTypes.length === 0) break;
        bType = rng.pick(affordableTypes);
      }

      if (!bType) break;
      usedTypes.add(bType.id);

      const city = rng.pick(CITIES);
      const investmentCost = bType.investment;
      if (player.cash - investmentCost < 0) continue;

      player.cash -= investmentCost;

      const biz: SimBusiness = {
        id: `biz-${nextId++}`,
        type: bType.id,
        city: city.id,
        name: `${bType.name} - ${city.name}`,
        level: 1,
        reputation: 40 + rng.random() * 20,
        cash: 0,
        dailyRevenue: 0,
        dailyExpense: 0,
        dailyProfit: 0,
        totalProfit: 0,
        healthScore: 50,
        inventories: [],
        employees: [],
      };

      // Create initial inventory
      const productDefs = PRODUCTS[bType.id] || [];
      const config = getPersonalityConfig(def.personality);
      for (const prod of productDefs) {
        const initialStock = Math.floor(prod.maxStock * 0.4);
        const marketRef = prod.basePrice * (1 + prod.suggestedMarkup);
        const sellPrice = calculateAIPrice(marketRef, def.personality, config.defaultPricingStrategy, 50, 0.4);

        biz.inventories.push({
          id: `inv-${nextId++}`,
          productName: prod.name,
          category: prod.category,
          quantity: initialStock,
          maxStock: prod.maxStock,
          purchasePrice: prod.basePrice,
          sellPrice,
        });

        player.cash -= prod.basePrice * initialStock;
      }

      player.businesses.push(biz);
    }

    // Ensure cash is not negative
    player.cash = Math.max(0, player.cash);
    player.netWorth = calculateNetWorth(player);
    players.push(player);
  }

  return players;
}

// ---- Calculate Net Worth ----
function calculateNetWorth(player: SimPlayer): number {
  const businessCash = player.businesses.reduce((sum, b) => sum + b.cash, 0);
  const inventoryValue = player.businesses.reduce(
    (sum, b) => sum + b.inventories.reduce((iSum, inv) => iSum + inv.quantity * inv.purchasePrice, 0),
    0,
  );
  const outstandingDebt = player.loans.reduce((sum, l) => sum + l.remainingDebt, 0);
  return roundTaka(player.cash + businessCash + inventoryValue - outstandingDebt);
}

// ---- Simulate One Business Day (Economy) ----
function simulateBusinessDay(biz: SimBusiness, owner: SimPlayer, rng: SeededRNG): void {
  const bType = BUSINESS_TYPES.find(b => b.id === biz.type);
  const cityData = CITIES.find(c => c.id === biz.city);
  if (!bType || !cityData) return;

  const bizConfig = getBusinessEconomyConfig(biz.type);

  // Calculate potential customers
  const totalStock = biz.inventories.reduce((sum, inv) => sum + inv.quantity, 0);
  const maxStockCapacity = biz.inventories.reduce((sum, inv) => sum + inv.maxStock, 0);
  const avgEmployeeSkill = biz.employees.length > 0
    ? biz.employees.reduce((sum, e) => sum + e.skill, 0) / biz.employees.length
    : 0;

  const potentialCustomers = calculatePotentialCustomers({
    baseCustomers: bType.baseCustomers,
    cityMultiplier: cityData.customerMultiplier,
    level: biz.level,
    reputation: biz.reputation,
    totalStock,
    maxStockCapacity,
    employeeCount: biz.employees.length,
    avgEmployeeSkill,
    eventCustomerEffect: 0, // No events in simulation
    businessDemandEffect: 0,
    businessTypeId: biz.type,
  });

  // Simulate sales for each product
  let totalRevenue = 0;
  let totalCOGS = 0;

  for (const inv of biz.inventories) {
    const prodDef = (PRODUCTS[biz.type] || []).find((p: ProductDef) => p.name === inv.productName);
    if (!prodDef) continue;

    const demandConfig = getProductDemandConfig(inv.productName);
    const marketRef = prodDef.basePrice * (1 + prodDef.suggestedMarkup);

    // Product demand
    const demand = calculateProductDemand({
      baseDemand: demandConfig.baseDemand,
      demandMultiplier: 1.0,
      eventDemandEffect: 0,
      productVolatility: demandConfig.volatility,
    });

    // Price demand
    const priceMult = calculatePriceDemandMultiplier({
      sellPrice: inv.sellPrice,
      marketReferencePrice: marketRef,
      productPriceSensitivity: demandConfig.priceSensitivity,
      businessPriceSensitivity: bizConfig.priceSensitivity,
    });

    // Total demand
    const totalDemand = potentialCustomers * demand * priceMult;
    const itemsSold = calculateItemsSold(totalDemand, inv.quantity);
    const revenue = calculateRevenue(itemsSold, inv.sellPrice);
    const cogs = calculateCostOfGoodsSold(itemsSold, inv.purchasePrice);

    // Update inventory
    inv.quantity = Math.max(0, inv.quantity - itemsSold);

    totalRevenue += revenue;
    totalCOGS += cogs;
  }

  // Calculate expenses
  const totalMonthlySalaries = biz.employees.reduce((sum, e) => sum + e.salary, 0);
  const grossProfit = totalRevenue - totalCOGS;

  const expenses = calculateBusinessExpenses({
    baseRent: bType.rent,
    baseUtilities: bType.utilities,
    level: biz.level,
    cityRentMultiplier: cityData.rentMultiplier,
    totalMonthlySalaries,
    businessLevel: biz.level,
    businessTypeId: biz.type,
    revenue: totalRevenue,
    grossProfit,
  });

  const netProfit = calculateNetProfit(totalRevenue, totalCOGS, expenses.totalExpense);

  // Update business state
  biz.dailyRevenue = totalRevenue;
  biz.dailyExpense = expenses.totalExpense;
  biz.dailyProfit = netProfit;
  biz.totalProfit += netProfit;

  // Mirror the engine: the till is swept to the owner and the business ends
  // the day at zero. Accumulating here *and* adding dailyProfit to player cash
  // in the tick loop double-counted every taka into net worth, which is what
  // this harness is used to measure.
  owner.cash += roundTaka(biz.cash + netProfit);
  biz.cash = 0;

  // Update health score
  const healthResult = calculateBusinessHealth({
    dailyProfit: netProfit,
    dailyRevenue: totalRevenue,
    businessCash: owner.cash,
    totalStock: biz.inventories.reduce((sum, inv) => sum + inv.quantity, 0),
    maxStockCapacity,
    reputation: biz.reputation,
    businessTypeId: biz.type,
  });
  biz.healthScore = healthResult.score;

  // Update reputation
  if (netProfit > 0) {
    biz.reputation = Math.min(100, biz.reputation + ECONOMY_CONFIG.reputationGainProfitable);
  } else {
    biz.reputation = Math.max(0, biz.reputation - ECONOMY_CONFIG.reputationLossUnprofitable);
  }
  const outOfStockRatio = biz.inventories.filter(inv => inv.quantity === 0).length / Math.max(biz.inventories.length, 1);
  biz.reputation = Math.max(0, biz.reputation - ECONOMY_CONFIG.reputationLossStockout * outOfStockRatio);
  biz.reputation = Math.max(0, biz.reputation - ECONOMY_CONFIG.reputationDecay);
}

// ---- Execute AI Action (In-Memory) ----
function executeSimAction(player: SimPlayer, action: ScoredAction, rng: SeededRNG): void {
  const config = getPersonalityConfig(player.personality);

  switch (action.action) {
    case 'BUY_INVENTORY': {
      const bizId = action.target;
      const biz = player.businesses.find(b => b.id === bizId);
      if (!biz) break;

      const productDefs = PRODUCTS[biz.type] || [];
      let totalSpent = 0;

      for (const inv of biz.inventories) {
        const prodDef = productDefs.find((p: ProductDef) => p.name === inv.productName);
        if (!prodDef) continue;

        const stockRatio = inv.quantity / inv.maxStock;
        if (stockRatio >= config.inventoryBuyThreshold) continue;

        const targetStock = Math.floor(inv.maxStock * (config.inventoryBuyThreshold + 0.2));
        const needed = targetStock - inv.quantity;
        if (needed <= 0) continue;

        const costPerUnit = prodDef.basePrice;
        const cost = costPerUnit * needed;

        if (player.cash - totalSpent < cost) continue;

        inv.quantity += needed;
        inv.purchasePrice = costPerUnit;
        totalSpent += cost;
      }

      if (totalSpent > 0) {
        player.cash -= roundTaka(totalSpent);
      }
      break;
    }

    case 'CHANGE_PRICE': {
      const bizId = action.target;
      const biz = player.businesses.find(b => b.id === bizId);
      if (!biz) break;

      const productDefs = PRODUCTS[biz.type] || [];
      for (const inv of biz.inventories) {
        const prodDef = productDefs.find((p: ProductDef) => p.name === inv.productName);
        if (!prodDef) continue;

        const marketRef = prodDef.basePrice * (1 + prodDef.suggestedMarkup);
        const stockRatio = inv.quantity / inv.maxStock;
        const strategy = selectPricingStrategy(player.personality, biz.healthScore, stockRatio);
        const newPrice = calculateAIPrice(marketRef, player.personality, strategy, biz.healthScore, stockRatio);

        if (Math.abs(newPrice - inv.sellPrice) / inv.sellPrice > 0.05) {
          inv.sellPrice = newPrice;
        }
      }
      break;
    }

    case 'HIRE_EMPLOYEE': {
      const bizId = action.target;
      const biz = player.businesses.find(b => b.id === bizId);
      if (!biz || biz.employees.length >= 5) break;

      const existingRoles = new Set(biz.employees.map(e => e.role));
      const hirePriority = ['SALESPERSON', 'CASHIER', 'MANAGER', 'CLEANER', 'DELIVERY_RIDER'];
      const roleToHire = hirePriority.find(r => !existingRoles.has(r)) || 'CASHIER';
      const roleDef = EMPLOYEE_ROLES.find(r => r.role === roleToHire);
      if (!roleDef) break;

      if (player.cash < roleDef.baseSalary * 2) break;

      const skill = 3 + rng.random() * 7;
      const efficiency = 0.5 + rng.random() * 0.5;

      biz.employees.push({
        role: roleDef.role,
        salary: roleDef.baseSalary,
        skill: roundTaka(skill * 10) / 10,
        efficiency: roundTaka(efficiency * 100) / 100,
      });
      break;
    }

    case 'UPGRADE_BUSINESS': {
      const bizId = action.target;
      const biz = player.businesses.find(b => b.id === bizId);
      if (!biz || biz.level >= 10) break;

      const bType = BUSINESS_TYPES.find(b => b.id === biz.type);
      if (!bType) break;

      const upgradeCost = Math.round(bType.investment * biz.level * 0.5);
      if (player.cash < upgradeCost) break;

      player.cash -= upgradeCost;
      biz.level += 1;
      break;
    }

    case 'CREATE_BUSINESS': {
      const businessType = action.params?.businessType as string | undefined;
      if (!businessType) break;

      const bType = BUSINESS_TYPES.find(b => b.id === businessType);
      if (!bType) break;

      if (player.cash < bType.investment * 1.2) break;

      const existingCities = player.businesses.map(b => b.city);
      const newCities = CITIES.filter(c => !existingCities.includes(c.id));
      const cityPool = newCities.length > 0 ? newCities : CITIES;
      const city = rng.pick(cityPool);

      player.cash -= bType.investment;

      const newBiz: SimBusiness = {
        id: `biz-new-${Date.now()}-${Math.floor(rng.random() * 10000)}`,
        type: bType.id,
        city: city.id,
        name: `${bType.name} - ${city.name}`,
        level: 1,
        reputation: 50,
        cash: 0,
        dailyRevenue: 0,
        dailyExpense: 0,
        dailyProfit: 0,
        totalProfit: 0,
        healthScore: 50,
        inventories: [],
        employees: [],
      };

      const productDefs = PRODUCTS[bType.id] || [];
      let invCost = 0;
      for (const prod of productDefs) {
        const initialStock = Math.floor(prod.maxStock * 0.4);
        const marketRef = prod.basePrice * (1 + prod.suggestedMarkup);
        const sellPrice = calculateAIPrice(marketRef, player.personality, config.defaultPricingStrategy, 50, 0.4);

        newBiz.inventories.push({
          id: `inv-new-${Date.now()}-${Math.floor(rng.random() * 10000)}`,
          productName: prod.name,
          category: prod.category,
          quantity: initialStock,
          maxStock: prod.maxStock,
          purchasePrice: prod.basePrice,
          sellPrice,
        });
        invCost += prod.basePrice * initialStock;
      }

      player.cash -= invCost;
      player.businesses.push(newBiz);
      break;
    }

    case 'SELL_BUSINESS': {
      const bizId = action.target;
      const bizIdx = player.businesses.findIndex(b => b.id === bizId);
      if (bizIdx === -1) break;

      const biz = player.businesses[bizIdx];
      const bType = BUSINESS_TYPES.find(b => b.id === biz.type);
      if (!bType) break;

      const inventoryValue = biz.inventories.reduce((sum, inv) => sum + inv.quantity * inv.purchasePrice, 0);
      const sellPrice = Math.round(bType.investment * 0.4 + inventoryValue * 0.5);

      player.cash += sellPrice;
      player.businesses.splice(bizIdx, 1);
      break;
    }

    case 'TAKE_LOAN': {
      if (player.loans.length >= 2) break;

      const loanAmount = Math.min(
        roundTaka(player.netWorth * (0.3 + rng.random() * 0.3)),
        2000000,
      );
      if (loanAmount < 100000) break;

      const interestRate = 0.05 + rng.random() * 0.03;
      const durationDays = 30 + Math.floor(rng.random() * 30);
      const totalOwed = roundTaka(loanAmount * (1 + interestRate));
      const dailyPayment = roundTaka(totalOwed / durationDays);

      player.loans.push({
        id: `loan-${Date.now()}-${Math.floor(rng.random() * 10000)}`,
        amount: loanAmount,
        remainingDebt: totalOwed,
        dailyPayment,
        daysRemaining: durationDays,
        interestRate,
      });

      player.cash += loanAmount;
      break;
    }

    case 'REPAY_LOAN': {
      const loanId = action.target;
      const loan = player.loans.find(l => l.id === loanId);
      if (!loan) break;

      const repayment = Math.min(loan.remainingDebt, Math.max(0, player.cash * 0.5));
      if (repayment < loan.dailyPayment) break;

      const newRemaining = Math.max(0, loan.remainingDebt - repayment);
      loan.remainingDebt = newRemaining;
      player.cash -= roundTaka(repayment);

      if (newRemaining <= 0) {
        player.loans = player.loans.filter(l => l.id !== loanId);
      }
      break;
    }

    case 'HOLD':
    default:
      break;
  }
}

// ---- Build Decision Context ----
function buildDecisionContext(player: SimPlayer, gameDay: number): AIDecisionContext {
  return {
    playerId: player.id,
    personality: player.personality,
    cash: player.cash,
    netWorth: player.netWorth,
    gameDay,
    lastActionAt: player.lastActionAt,
    // This harness simulates AI players against each other with no human in
    // the world, so there is nothing to be a rival to.
    rivals: EMPTY_RIVAL_INTEL,
    lastPoachAt: 0,
    businesses: player.businesses.map(b => ({
      id: b.id,
      type: b.type,
      city: b.city,
      name: b.name,
      level: b.level,
      reputation: b.reputation,
      cash: b.cash,
      dailyRevenue: b.dailyRevenue,
      dailyExpense: b.dailyExpense,
      dailyProfit: b.dailyProfit,
      totalProfit: b.totalProfit,
      healthScore: b.healthScore,
      inventories: b.inventories.map(inv => ({
        id: inv.id,
        productName: inv.productName,
        quantity: inv.quantity,
        maxStock: inv.maxStock,
        purchasePrice: inv.purchasePrice,
        sellPrice: inv.sellPrice,
      })),
      employeeCount: b.employees.length,
      // The offline simulator does not model CX or expansion state; supply the
      // neutral defaults the snapshot type requires.
      satisfactionScore: 50,
      loyaltyScore: 50,
      repeatCustomerRate: 0,
      location: null,
      setupDaysRemaining: 0,
    })),
    activeLoans: player.loans.map(l => ({
      id: l.id,
      amount: l.amount,
      remainingDebt: l.remainingDebt,
      dailyPayment: l.dailyPayment,
      daysRemaining: l.daysRemaining,
    })),
    activeEvents: [],
    marketPrices: {},
    // Expansion state is not modelled by the offline simulator.
    expansionCount: player.businesses.length,
    lastExpansionAt: 0,
    playerLevel: 1,
  };
}

// ---- Process Loan Payments ----
function processLoanPayments(player: SimPlayer): void {
  const remainingLoans: SimLoan[] = [];
  for (const loan of player.loans) {
    player.cash -= loan.dailyPayment;
    loan.remainingDebt -= loan.dailyPayment;
    loan.daysRemaining -= 1;
    if (loan.remainingDebt <= 0 || loan.daysRemaining <= 0) {
      // Loan paid off or expired
      if (loan.remainingDebt > 0) {
        player.cash -= loan.remainingDebt; // Pay remaining
      }
    } else {
      remainingLoans.push(loan);
    }
  }
  player.loans = remainingLoans;
}

// ---- Mandatory Restock (Simulation Version) ----
function performSimMandatoryRestock(player: SimPlayer): void {
  const MANDATORY_RESTOCK_THRESHOLD = 0.20; // Below 20% → restock
  const MANDATORY_RESTOCK_TARGET = 0.40;    // Restock to 40% of maxStock

  if (player.cash <= 0) return;

  let totalSpent = 0;

  for (const biz of player.businesses) {
    const productDefs = PRODUCTS[biz.type] || [];

    for (const inv of biz.inventories) {
      const prodDef = productDefs.find((p: ProductDef) => p.name === inv.productName);
      if (!prodDef) continue;

      const maxStock = inv.maxStock;
      const stockRatio = inv.quantity / maxStock;

      // Only restock if below threshold
      if (stockRatio >= MANDATORY_RESTOCK_THRESHOLD) continue;

      // Calculate how much to buy (bring to 40% of maxStock)
      const targetQuantity = Math.floor(maxStock * MANDATORY_RESTOCK_TARGET);
      const quantityToAdd = Math.max(0, targetQuantity - inv.quantity);
      if (quantityToAdd <= 0) continue;

      const costPerUnit = prodDef.basePrice;
      const cost = costPerUnit * quantityToAdd;

      // Check if player can afford this restock
      if (player.cash - totalSpent - cost < 0) continue;

      inv.quantity += quantityToAdd;
      totalSpent += cost;
    }
  }

  if (totalSpent > 0) {
    player.cash -= roundTaka(totalSpent);
  }
}

// ---- Run Full Simulation ----
/** A problem the balance check found, as data rather than as a console line. */
export interface BalanceIssue {
  /** `error` fails the build; `warning` is reported but tolerated. */
  severity: 'error' | 'warning';
  code:
    | 'BANKRUPT'
    | 'NEAR_BANKRUPTCY'
    | 'DOMINATION'
    | 'SLIGHT_DOMINATION'
    | 'EXPLOSIVE_GROWTH'
    | 'SEVERE_DECLINE'
    | 'HIGH_DIVERGENCE'
    | 'MODERATE_DIVERGENCE'
    | 'EXTREME_DIVERGENCE'
    | 'FIELD_COLLAPSE'
    | 'NON_FINITE';
  message: string;
  playerId?: string;
  personality?: AIPersonality;
}

export interface SimulationResult {
  days: number;
  players: SimPlayer[];
  metrics: DayMetrics[];
  /** Everything the balance check found. */
  issues: BalanceIssue[];
  /** Mean final net worth per personality. */
  personalityAvgNetWorth: Record<string, number>;
  /** Spread of final net worth across players, as a coefficient of variation. */
  coefficientOfVariation: number;
  /** How many strategic actions each player took, by action name. */
  actionsTaken: Record<string, number>;
  /** Players that never took a single action — the "stuck on HOLD" regression. */
  inertPlayers: string[];
}

export interface SimulationOptions {
  /** Days to simulate. */
  days?: number;
  /** Seed. Fixed by default, which is what makes this usable as a test. */
  seed?: number;
  /** Print the full human-readable report. Off by default so tests stay quiet. */
  verbose?: boolean;
}

export function runSimulation(options: SimulationOptions = {}): SimulationResult {
  const { days: TOTAL_DAYS = 100, seed = 42, verbose = false } = options;

  const rng = new SeededRNG(seed);
  const players = createAIPlayers(rng);

  if (verbose) {
    console.log('='.repeat(80));
    console.log(`🤖 AI SIMULATION TEST — ${TOTAL_DAYS} Game Days`);
    console.log('='.repeat(80));
    console.log(`\n📊 Initial State:`);
    for (const p of players) {
      console.log(`  ${p.name} (${p.personality}): ৳${Math.round(p.netWorth).toLocaleString()} cash, ${p.businesses.length} businesses`);
    }
  }

  const metrics: DayMetrics[] = [];
  // Instrumented so a test can assert the AI is actually deciding rather than
  // silently holding every day — a failure mode that leaves every other number
  // looking perfectly reasonable.
  const actionsTaken: Record<string, number> = {};
  const actedAtLeastOnce = new Set<string>();

  for (let day = 1; day <= TOTAL_DAYS; day++) {
    // Process each player
    for (const player of players) {
      // 1. Run economy for each business
      for (const biz of player.businesses) {
        // simulateBusinessDay sweeps the day's result into player.cash itself,
        // exactly as simulateBusinessTick does.
        simulateBusinessDay(biz, player, rng);
      }

      // 2. Process loan payments
      processLoanPayments(player);

      // 3. Mandatory restock of critically low inventory (background action)
      performSimMandatoryRestock(player);

      // 4. AI decision
      const ctx = buildDecisionContext(player, day);
      const bestAction = selectBestAction(ctx);

      if (bestAction.action !== 'HOLD') {
        executeSimAction(player, bestAction, rng);
        player.lastActionAt = day;
        actionsTaken[bestAction.action] = (actionsTaken[bestAction.action] ?? 0) + 1;
        actedAtLeastOnce.add(player.id);
      }

      // 5. Recalculate net worth
      player.netWorth = calculateNetWorth(player);

      // 6. Safety: prevent infinite negative
      if (player.cash < -1000000) {
        player.cash = -1000000; // Cap losses
      }
    }

    // Record metrics
    const dayMetrics: DayMetrics = {
      day,
      playerNetWorth: {},
      playerCash: {},
      playerDailyProfit: {},
      playerBusinessCount: {},
      playerLoanCount: {},
      playerInventoryAvg: {},
    };
    for (const p of players) {
      dayMetrics.playerNetWorth[p.id] = p.netWorth;
      dayMetrics.playerCash[p.id] = p.cash;
      dayMetrics.playerDailyProfit[p.id] = p.businesses.reduce((s, b) => s + b.dailyProfit, 0);
      dayMetrics.playerBusinessCount[p.id] = p.businesses.length;
      dayMetrics.playerLoanCount[p.id] = p.loans.length;
      const totalStock = p.businesses.reduce((s, b) => s + b.inventories.reduce((is2, inv) => is2 + inv.quantity, 0), 0);
      const totalMax = p.businesses.reduce((s, b) => s + b.inventories.reduce((is2, inv) => is2 + inv.maxStock, 0), 0);
      dayMetrics.playerInventoryAvg[p.id] = totalMax > 0 ? totalStock / totalMax : 0;
    }
    metrics.push(dayMetrics);
  }

  const analysis = analyseBalance(players, metrics);

  if (verbose) {
    printSummary('30-DAY SUMMARY', players, metrics, Math.min(30, TOTAL_DAYS));
    printSummary(`${TOTAL_DAYS}-DAY SUMMARY`, players, metrics, TOTAL_DAYS);
    printBalanceReport(analysis);
  }

  return {
    days: TOTAL_DAYS,
    players,
    metrics,
    actionsTaken,
    inertPlayers: players.filter(p => !actedAtLeastOnce.has(p.id)).map(p => p.name),
    ...analysis,
  };
}

// ---- Print Per-Personality Summary ----
function printSummary(
  title: string,
  players: SimPlayer[],
  metrics: DayMetrics[],
  atDay: number,
): void {
  const snapshot = metrics[atDay - 1]; // 0-indexed
  if (!snapshot) return;

  console.log('\n' + '='.repeat(80));
  console.log(`📈 ${title} (Day ${atDay})`);
  console.log('='.repeat(80));

  // Group by personality
  const personalities: AIPersonality[] = ['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE', 'TRADER', 'EXPANSIONIST'];

  for (const personality of personalities) {
    const matching = players.filter(p => p.personality === personality);
    if (matching.length === 0) continue;

    const avgNetWorth = matching.reduce((s, p) => s + snapshot.playerNetWorth[p.id], 0) / matching.length;
    const avgCash = matching.reduce((s, p) => s + snapshot.playerCash[p.id], 0) / matching.length;
    const avgProfit = matching.reduce((s, p) => s + snapshot.playerDailyProfit[p.id], 0) / matching.length;
    const avgBizCount = matching.reduce((s, p) => s + snapshot.playerBusinessCount[p.id], 0) / matching.length;
    const avgLoanCount = matching.reduce((s, p) => s + snapshot.playerLoanCount[p.id], 0) / matching.length;
    const avgInventory = matching.reduce((s, p) => s + snapshot.playerInventoryAvg[p.id], 0) / matching.length;

    const config = getPersonalityConfig(personality);
    console.log(`\n  ${config.icon} ${personality} (${matching.length} players):`);
    console.log(`    Avg Net Worth:  ৳${Math.round(avgNetWorth).toLocaleString()}`);
    console.log(`    Avg Cash:       ৳${Math.round(avgCash).toLocaleString()}`);
    console.log(`    Avg Daily Profit: ৳${Math.round(avgProfit).toLocaleString()}`);
    console.log(`    Avg Businesses: ${avgBizCount.toFixed(1)}`);
    console.log(`    Avg Loans:      ${avgLoanCount.toFixed(1)}`);
    console.log(`    Avg Inventory:  ${(avgInventory * 100).toFixed(1)}%`);
  }

  // Overall
  const overallNetWorth = players.reduce((s, p) => s + snapshot.playerNetWorth[p.id], 0) / players.length;
  const overallProfit = players.reduce((s, p) => s + snapshot.playerDailyProfit[p.id], 0) / players.length;
  const totalNetWorth = players.reduce((s, p) => s + snapshot.playerNetWorth[p.id], 0);

  console.log(`\n  📊 Overall:`);
  console.log(`    Avg Net Worth:  ৳${Math.round(overallNetWorth).toLocaleString()}`);
  console.log(`    Total Net Worth: ৳${Math.round(totalNetWorth).toLocaleString()}`);
  console.log(`    Avg Daily Profit: ৳${Math.round(overallProfit).toLocaleString()}`);

  // Per-player detail
  console.log(`\n  📋 Per-Player Detail:`);
  for (const p of players) {
    const config = getPersonalityConfig(p.personality);
    console.log(
      `    ${p.name} (${config.icon}): NW=৳${Math.round(snapshot.playerNetWorth[p.id]).toLocaleString()}, ` +
      `Cash=৳${Math.round(snapshot.playerCash[p.id]).toLocaleString()}, ` +
      `Profit=৳${Math.round(snapshot.playerDailyProfit[p.id]).toLocaleString()}, ` +
      `Biz=${snapshot.playerBusinessCount[p.id]}, Loans=${snapshot.playerLoanCount[p.id]}`,
    );
  }
}

// ---- Check Balance Issues ----
export interface BalanceAnalysis {
  issues: BalanceIssue[];
  personalityAvgNetWorth: Record<string, number>;
  coefficientOfVariation: number;
}

/**
 * Judge a finished simulation.
 *
 * Pure: takes the simulated state, returns a verdict. It used to print the
 * verdict and throw it away, which is how an 8x payback spread and five
 * bankrupt AI competitors sat in the game for months while a 1,000-line harness
 * that detected both ran green in somebody's terminal.
 *
 * Severity is the contract with the test suite, and the split is deliberate:
 *
 *   `error`   — something this model CAN measure reliably. A non-finite value,
 *               an AI that never acts, the whole field collapsing. These fail
 *               the build.
 *
 *   `warning` — something this model can only *indicate*. Exact bankruptcy
 *               counts and divergence are the obvious cases: `BALANCE-RISKS.md`
 *               records that this simulation omits events, market price
 *               variation, employee skill bonuses and human competition — all
 *               of which are positive factors — so it reliably reports MORE
 *               bankruptcies than the real engine produces.
 *
 * Warnings are not ignored. The test suite ratchets them: the current counts
 * are pinned, so they can get better and never worse. Tightening them into
 * errors requires validating against the real engine first, which is what that
 * document asks for.
 */
export function analyseBalance(players: SimPlayer[], metrics: DayMetrics[]): BalanceAnalysis {
  const issues: BalanceIssue[] = [];
  const finalSnapshot = metrics[metrics.length - 1];
  const personalities: AIPersonality[] = ['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE', 'TRADER', 'EXPANSIONIST'];

  // ---- Per-personality final net worths ----
  const personalityAvgNetWorth: Record<string, number> = {};
  for (const personality of personalities) {
    const matching = players.filter(p => p.personality === personality);
    const nws = matching.map(p => finalSnapshot.playerNetWorth[p.id]);
    personalityAvgNetWorth[personality] = nws.length > 0
      ? nws.reduce((s, v) => s + v, 0) / nws.length
      : 0;
  }

  // ---- 0. Nothing non-finite escaped the model ----
  // A NaN propagating through net worth makes every check below meaningless
  // while still looking like a number, so it is tested before anything else.
  for (const p of players) {
    const nw = finalSnapshot.playerNetWorth[p.id];
    if (!Number.isFinite(nw)) {
      issues.push({
        severity: 'error',
        code: 'NON_FINITE',
        message: `${p.name} (${p.personality}) has a non-finite net worth: ${nw}`,
        playerId: p.id,
        personality: p.personality,
      });
    }
  }

  // ---- 1. Personality domination ----
  const allAvgs = Object.values(personalityAvgNetWorth);
  const maxAvg = Math.max(...allAvgs);
  const minAvg = Math.min(...allAvgs);
  const dominating = Object.entries(personalityAvgNetWorth).find(([, v]) => v === maxAvg)?.[0];

  if (minAvg <= 0 && maxAvg > 0) {
    // The original check guarded on `minAvg > 0`, which meant the worst case of
    // all — a personality averaging a net loss while another thrives — was the
    // one case it never reported.
    issues.push({
      severity: 'warning',
      code: 'DOMINATION',
      message: `${dominating} averages ৳${Math.round(maxAvg).toLocaleString()} while the weakest personality averages a loss of ৳${Math.round(Math.abs(minAvg)).toLocaleString()}`,
    });
  } else if (minAvg > 0 && maxAvg > minAvg * 3) {
    issues.push({
      severity: 'warning',
      code: 'DOMINATION',
      message: `${dominating} dominates: best average (৳${Math.round(maxAvg).toLocaleString()}) is more than 3x the worst (৳${Math.round(minAvg).toLocaleString()})`,
    });
  } else if (minAvg > 0 && maxAvg > minAvg * 2) {
    issues.push({
      severity: 'warning',
      code: 'SLIGHT_DOMINATION',
      message: `${dominating} is slightly dominant: best average is more than 2x the worst`,
    });
  }

  // ---- 2. Bankruptcy ----
  // The regression this harness was built for: an inventory death spiral that
  // emptied every AI's shelves and bankrupted the field.
  for (const p of players) {
    const nw = finalSnapshot.playerNetWorth[p.id];
    if (!Number.isFinite(nw)) continue;

    if (nw < 0) {
      issues.push({
        severity: 'warning',
        code: 'BANKRUPT',
        message: `${p.name} (${p.personality}) is bankrupt: net worth ৳${Math.round(nw).toLocaleString()}`,
        playerId: p.id,
        personality: p.personality,
      });
    } else if (nw < 100_000) {
      issues.push({
        severity: 'warning',
        code: 'NEAR_BANKRUPTCY',
        message: `${p.name} (${p.personality}) is near bankruptcy: net worth ৳${Math.round(nw).toLocaleString()}`,
        playerId: p.id,
        personality: p.personality,
      });
    }
  }

  // A single bankruptcy in a pessimistic model is noise. Most of the field
  // going under is not — no omitted positive factor rescues half a market.
  const bankruptCount = players.filter(p => {
    const nw = finalSnapshot.playerNetWorth[p.id];
    return Number.isFinite(nw) && nw < 0;
  }).length;

  if (players.length > 0 && bankruptCount > players.length / 2) {
    issues.push({
      severity: 'error',
      code: 'FIELD_COLLAPSE',
      message: `${bankruptCount} of ${players.length} competitors are bankrupt — the market has collapsed, not merely thinned`,
    });
  }

  // ---- 3. Growth patterns ----
  const at = (day: number) => metrics[Math.min(day, metrics.length) - 1];
  const early = at(30);
  const late = metrics[metrics.length - 1];

  if (early && late && early !== late) {
    for (const p of players) {
      const nwEarly = early.playerNetWorth[p.id];
      const nwLate = late.playerNetWorth[p.id];
      if (!Number.isFinite(nwEarly) || !Number.isFinite(nwLate) || nwEarly <= 0) continue;

      if (nwLate > nwEarly * 4) {
        issues.push({
          severity: 'warning',
          code: 'EXPLOSIVE_GROWTH',
          message: `${p.name} quadrupled: ৳${Math.round(nwEarly).toLocaleString()} → ৳${Math.round(nwLate).toLocaleString()}`,
          playerId: p.id,
          personality: p.personality,
        });
      }
      if (nwLate < nwEarly * 0.3) {
        issues.push({
          severity: 'warning',
          code: 'SEVERE_DECLINE',
          message: `${p.name} declined severely: ৳${Math.round(nwEarly).toLocaleString()} → ৳${Math.round(nwLate).toLocaleString()}`,
          playerId: p.id,
          personality: p.personality,
        });
      }
    }
  }

  // ---- 4. Divergence across the field ----
  const finalNWs = players
    .map(p => finalSnapshot.playerNetWorth[p.id])
    .filter(nw => Number.isFinite(nw));
  const avgNW = finalNWs.length > 0
    ? finalNWs.reduce((s, v) => s + v, 0) / finalNWs.length
    : 0;
  const stdDev = finalNWs.length > 0
    ? Math.sqrt(finalNWs.reduce((s, v) => s + (v - avgNW) ** 2, 0) / finalNWs.length)
    : 0;
  const coefficientOfVariation = avgNW !== 0 ? stdDev / Math.abs(avgNW) : 0;

  if (coefficientOfVariation > 2.0) {
    issues.push({
      severity: 'error',
      code: 'EXTREME_DIVERGENCE',
      message: `Net worth has shattered: coefficient of variation ${coefficientOfVariation.toFixed(2)}`,
    });
  } else if (coefficientOfVariation > 1.0) {
    issues.push({
      severity: 'warning',
      code: 'HIGH_DIVERGENCE',
      message: `Net worth has diverged: coefficient of variation ${coefficientOfVariation.toFixed(2)} (should be under 1.0)`,
    });
  } else if (coefficientOfVariation > 0.7) {
    issues.push({
      severity: 'warning',
      code: 'MODERATE_DIVERGENCE',
      message: `Net worth is spreading: coefficient of variation ${coefficientOfVariation.toFixed(2)}`,
    });
  }

  return { issues, personalityAvgNetWorth, coefficientOfVariation };
}

/** Human-readable version of the analysis, for a direct run. */
function printBalanceReport(analysis: BalanceAnalysis): void {
  console.log('\n' + '='.repeat(80));
  console.log('⚖️  BALANCE CHECK');
  console.log('='.repeat(80));

  const overallAvg =
    Object.values(analysis.personalityAvgNetWorth).reduce((s, v) => s + v, 0) /
    Math.max(1, Object.keys(analysis.personalityAvgNetWorth).length);

  console.log('\n  📊 Personality Net Worth Comparison:');
  for (const [personality, avg] of Object.entries(analysis.personalityAvgNetWorth)) {
    const ratio = overallAvg > 0 ? avg / overallAvg : 0;
    const bar = '█'.repeat(Math.max(0, Math.round(ratio * 20)));
    console.log(`    ${personality.padEnd(15)}: ৳${Math.round(avg).toLocaleString().padStart(12)} (${ratio.toFixed(2)}x) ${bar}`);
  }

  console.log(`\n  📉 Net worth divergence (CoV): ${analysis.coefficientOfVariation.toFixed(2)}`);

  const errors = analysis.issues.filter(i => i.severity === 'error');
  const warnings = analysis.issues.filter(i => i.severity === 'warning');

  console.log('\n' + '='.repeat(80));
  console.log('📋 BALANCE ISSUES');
  console.log('='.repeat(80));

  if (analysis.issues.length === 0) {
    console.log('\n  ✅ No balance issues detected.');
  } else {
    if (errors.length > 0) {
      console.log(`\n  ❌ ${errors.length} error(s):`);
      for (const issue of errors) console.log(`    [${issue.code}] ${issue.message}`);
    }
    if (warnings.length > 0) {
      console.log(`\n  ⚠️  ${warnings.length} warning(s):`);
      for (const issue of warnings) console.log(`    [${issue.code}] ${issue.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('🏁 SIMULATION COMPLETE');
  console.log('='.repeat(80));
}

// ---- Run ----
//
// Guarded, so importing this module from a test does not silently simulate a
// hundred days and print two hundred lines as a side effect of the import.
// Run it directly for the full human-readable report.
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  /ai-simulation-test\.[cm]?ts$/.test(process.argv[1]);

if (invokedDirectly) {
  runSimulation({ verbose: true });
}
