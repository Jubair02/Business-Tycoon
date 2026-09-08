// ============================================
// Bangladesh Business Tycoon - Balance Simulation Utility
// Phase 1: Dev-only tool to simulate multiple game days
// and verify balance across all business types
//
// Usage: npx tsx src/lib/game/economy/balance-sim.ts
//
// ⚠️  DEVELOPER WARNING — SIMPLIFIED MODEL
// ⚠️  This simulation assumes ideal conditions:
//    - Full stock restocked every day (no stockouts)
//    - No employees (no salary costs, no skill bonuses)
//    - No events (no demand/price shocks)
//    - No market price variation (priceMultiplier=1)
//    - Level 1, Reputation 50, Dhaka only
// ⚠️  Real engine results will differ due to events, competition,
//    inventory depletion, employee costs, and market variation.
// ⚠️  DO NOT use this as the sole source of truth for balance.
// ⚠️  Use full-engine integration results for final decisions.
// ============================================

import {
  calculatePotentialCustomers,
  calculatePriceDemandMultiplier,
  simulateProductSales,
  calculateBusinessExpenses,
  calculateNetProfit,
  calculateBusinessHealth,
  calculateROI,
  roundTaka,
} from './formulas';
import { getBusinessEconomyConfig } from './business-config';
import { getProductDemandConfig } from './product-demand';
import { ECONOMY_CONFIG } from './economy-config';
import { PRODUCTS, CITIES, BUSINESS_TYPES } from '../../game-data';
import type { RiskLevel } from './types';

interface DayResult {
  day: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  customers: number;
}

interface SimulationResult {
  businessType: string;
  city: string;
  investment: number;
  days: DayResult[];
  averageRevenue: number;
  averageExpenses: number;
  averageProfit: number;
  averageCOGS: number;
  bestDay: DayResult;
  worstDay: DayResult;
  profitableDays: number;
  profitabilityRate: number;
  estimatedPayback: number | null;
  riskLevel: RiskLevel;
}

/**
 * Simulate a single business type for N game days.
 * Uses default settings: Level 1, Reputation 50, Dhaka city.
 * Assumes full stock at suggested markup pricing.
 */
function simulateBusinessDays(
  businessTypeId: string,
  cityId: string = 'DHAKA',
  numDays: number = 100,
  level: number = 1,
  reputation: number = 50
): SimulationResult {
  const bt = BUSINESS_TYPES.find(b => b.id === businessTypeId);
  const city = CITIES.find(c => c.id === cityId);
  if (!bt || !city) throw new Error(`Invalid business type: ${businessTypeId} or city: ${cityId}`);

  const products = PRODUCTS[businessTypeId] || [];
  const economyConfig = getBusinessEconomyConfig(businessTypeId);

  // Setup inventory: full stock at suggested markup
  const inventory = products.map(p => ({
    productName: p.name,
    quantity: p.maxStock,
    purchasePrice: p.basePrice,  // Buy at base price (priceMultiplier = 1)
    sellPrice: Math.round(p.basePrice * (1 + p.suggestedMarkup)),
  }));

  const maxStockCapacity = products.reduce((sum, p) => sum + p.maxStock, 0);
  const days: DayResult[] = [];

  let currentReputation = reputation;
  let cumulativeProfit = 0;

  for (let day = 1; day <= numDays; day++) {
    // Calculate customers
    const totalStock = inventory.reduce((sum, inv) => sum + inv.quantity, 0);
    const customers = calculatePotentialCustomers({
      baseCustomers: bt.baseCustomers,
      cityMultiplier: city.customerMultiplier,
      level,
      reputation: currentReputation,
      totalStock,
      maxStockCapacity,
      employeeCount: 0,
      avgEmployeeSkill: 0,
      eventCustomerEffect: 0,
      businessDemandEffect: 0,
      businessTypeId,
    });

    // Simulate product sales
    let dayRevenue = 0;
    let dayCOGS = 0;

    for (const inv of inventory) {
      if (inv.quantity <= 0) continue;

      const productDef = products.find(p => p.name === inv.productName);
      if (!productDef) continue;

      const prodDemandConfig = getProductDemandConfig(inv.productName);

      const salesResult = simulateProductSales({
        inventoryId: 'sim',
        productName: inv.productName,
        quantity: inv.quantity,
        purchasePrice: inv.purchasePrice,
        sellPrice: inv.sellPrice,
        // Market reference = typical retail price (cost × (1 + suggestedMarkup))
        marketReferencePrice: Math.round(productDef.basePrice * (1 + productDef.suggestedMarkup)),
        baseDemand: prodDemandConfig.baseDemand,
        demandMultiplier: 1,
        eventDemandEffect: 0,
        productPriceSensitivity: prodDemandConfig.priceSensitivity,
        productVolatility: prodDemandConfig.volatility,
        businessPriceSensitivity: economyConfig.priceSensitivity,
        potentialCustomers: customers,
      });

      dayRevenue += salesResult.revenue;
      dayCOGS += salesResult.costOfGoodsSold;

      // Reduce inventory (restock to full for next day to simulate continuous operation)
      inv.quantity = Math.max(0, inv.quantity - salesResult.itemsSold);
      // Auto-restock (simulates player restocking)
      inv.quantity = productDef.maxStock;
    }

    const grossProfit = dayRevenue - dayCOGS;

    // Calculate expenses
    const expenses = calculateBusinessExpenses({
      baseRent: bt.rent,
      level,
      cityRentMultiplier: city.rentMultiplier,
      totalMonthlySalaries: 0,
      businessLevel: level,
      businessTypeId,
      revenue: dayRevenue,
      grossProfit,
    });

    const netProfit = calculateNetProfit(dayRevenue, dayCOGS, expenses.totalExpense);
    cumulativeProfit += netProfit;

    // Update reputation
    if (netProfit > 0) currentReputation = Math.min(100, currentReputation + 0.3);
    else currentReputation = Math.max(0, currentReputation - 0.5);

    days.push({
      day,
      revenue: roundTaka(dayRevenue),
      cogs: roundTaka(dayCOGS),
      grossProfit: roundTaka(grossProfit),
      expenses: roundTaka(expenses.totalExpense),
      netProfit: roundTaka(netProfit),
      customers,
    });
  }

  // Aggregate stats
  const totalRevenue = days.reduce((s, d) => s + d.revenue, 0);
  const totalExpenses = days.reduce((s, d) => s + d.expenses, 0);
  const totalProfit = days.reduce((s, d) => s + d.netProfit, 0);
  const totalCOGS = days.reduce((s, d) => s + d.cogs, 0);
  const profitableDays = days.filter(d => d.netProfit > 0).length;

  const bestDay = days.reduce((best, d) => d.netProfit > best.netProfit ? d : best, days[0]);
  const worstDay = days.reduce((worst, d) => d.netProfit < worst.netProfit ? d : worst, days[0]);

  const avgDailyProfit = totalProfit / numDays;
  const estimatedPayback = avgDailyProfit > 0 ? Math.ceil(bt.investment / avgDailyProfit) : null;

  return {
    businessType: bt.name,
    city: city.name,
    investment: bt.investment,
    days,
    averageRevenue: roundTaka(totalRevenue / numDays),
    averageExpenses: roundTaka(totalExpenses / numDays),
    averageProfit: roundTaka(totalProfit / numDays),
    averageCOGS: roundTaka(totalCOGS / numDays),
    bestDay,
    worstDay,
    profitableDays,
    profitabilityRate: Math.round((profitableDays / numDays) * 100),
    estimatedPayback,
    riskLevel: economyConfig.riskLevel,
  };
}

/**
 * Run balance simulation for all business types and print results.
 */
export function runBalanceSimulation(numDays: number = 100): void {
  console.log('\n============================================');
  console.log('  BANGLADESH BUSINESS TYCOON - BALANCE SIM');
  console.log(`  Simulating ${numDays} game days per business`);
  console.log('  City: Dhaka | Level: 1 | Reputation: 50');
  console.log('  Full stock | No employees | No events');
  console.log('============================================\n');

  const results: SimulationResult[] = [];

  for (const bt of BUSINESS_TYPES) {
    const result = simulateBusinessDays(bt.id, 'DHAKA', numDays);
    results.push(result);

    console.log(`📊 ${result.businessType} (${result.riskLevel} Risk)`);
    console.log(`   Investment: ৳${result.investment.toLocaleString()}`);
    console.log(`   Avg Revenue:  ৳${result.averageRevenue.toLocaleString()}/day`);
    console.log(`   Avg COGS:     ৳${result.averageCOGS.toLocaleString()}/day`);
    console.log(`   Avg Expenses: ৳${result.averageExpenses.toLocaleString()}/day`);
    console.log(`   Avg Profit:   ৳${result.averageProfit.toLocaleString()}/day`);
    console.log(`   Best Day:     ৳${result.bestDay.netProfit.toLocaleString()}`);
    console.log(`   Worst Day:    ৳${result.worstDay.netProfit.toLocaleString()}`);
    console.log(`   Profitable:   ${result.profitabilityRate}% of days`);
    console.log(`   Payback:      ${result.estimatedPayback ? `${result.estimatedPayback} days` : 'Not possible'}`);
    console.log('');
  }

  // Summary comparison
  console.log('============================================');
  console.log('  BALANCE COMPARISON');
  console.log('============================================\n');

  const sorted = [...results].sort((a, b) => b.averageProfit - a.averageProfit);
  console.log('By Average Profit:');
  sorted.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.businessType}: ৳${r.averageProfit.toLocaleString()}/day`);
  });

  const byPayback = results.filter(r => r.estimatedPayback !== null).sort((a, b) => (a.estimatedPayback || 0) - (b.estimatedPayback || 0));
  console.log('\nBy Payback Period:');
  byPayback.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.businessType}: ${r.estimatedPayback} days`);
  });

  console.log('\nBest Early Game Business:', sorted[0]?.businessType || 'N/A');
  const stable = [...results].sort((a, b) => b.profitabilityRate - a.profitabilityRate);
  console.log('Most Stable Business:', stable[0]?.businessType || 'N/A');
  const risky = [...results].sort((a, b) => a.profitabilityRate - b.profitabilityRate);
  console.log('Highest Risk Business:', risky[0]?.businessType || 'N/A');

  // Warnings
  console.log('\n============================================');
  console.log('  BALANCE WARNINGS');
  console.log('============================================\n');

  for (const r of results) {
    if (r.averageProfit < 0) {
      console.log(`⚠️  ${r.businessType} is UNPROFITABLE on average (৳${r.averageProfit}/day). Needs balance adjustment.`);
    }
    if (r.profitabilityRate < 60) {
      console.log(`⚠️  ${r.businessType} is profitable only ${r.profitabilityRate}% of days. May be too risky for intended difficulty.`);
    }
    if (r.estimatedPayback && r.estimatedPayback > 200) {
      console.log(`⚠️  ${r.businessType} payback period is ${r.estimatedPayback} days. May be too slow for engaging gameplay.`);
    }
  }

  console.log('\nSimulation complete.');
}

// Run if called directly
runBalanceSimulation(100);
