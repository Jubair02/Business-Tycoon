// ============================================
// Business Analytics API
// GET /api/businesses/[id]/analytics
// Phase 1: Comprehensive business performance data
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlayerId, notFound, forbidden, handleApiError, successResponse } from '@/lib/errors';
import { getBusinessType } from '@/lib/game-data';
import { calculateBusinessHealth, calculateROI, classifyDemandLevel } from '@/lib/game/economy/formulas';
import { getBusinessEconomyConfig } from '@/lib/game/economy/business-config';
import { getProductDemandConfig } from '@/lib/game/economy/product-demand';
import type { BusinessAnalytics, ProductPerformance, DemandLevel, DemandTrend } from '@/lib/game/economy/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const playerId = await requirePlayerId();
    const { id } = await params;

    const business = await db.business.findUnique({
      where: { id },
      include: {
        inventories: { orderBy: { createdAt: 'desc' } },
        employees: { orderBy: { hiredAt: 'asc' } },
        metrics: { orderBy: { gameDay: 'desc' }, take: 30 },
      },
    });

    if (!business) throw notFound('Business');
    if (business.playerId !== playerId) throw forbidden();

    const businessType = getBusinessType(business.type);
    if (!businessType) throw notFound('Business type');

    const economyConfig = getBusinessEconomyConfig(business.type);

    // ---- Summary ----
    const dailyCOGS = business.dailyCOGS || 0;
    const grossProfit = business.dailyRevenue - dailyCOGS;
    const summary = {
      revenue: Math.round(business.dailyRevenue),
      expenses: Math.round(business.dailyExpense),
      profit: Math.round(business.dailyProfit),
      customers: business.dailyCustomers || 0,
      costOfGoodsSold: Math.round(dailyCOGS),
      grossProfit: Math.round(grossProfit),
    };

    // ---- Health Score ----
    const productDefs = (await db.product.findMany()).filter(p => {
      return business.inventories.some(inv => inv.productName === p.name);
    });
    const maxStockCapacity = business.inventories.length * 100; // Approximate
    const totalStock = business.inventories.reduce((sum, inv) => sum + inv.quantity, 0);

    const health = calculateBusinessHealth({
      dailyProfit: business.dailyProfit,
      dailyRevenue: business.dailyRevenue,
      businessCash: business.cash,
      totalStock,
      maxStockCapacity: Math.max(maxStockCapacity, 1),
      reputation: business.reputation,
      businessTypeId: business.type,
    });

    // ---- ROI & Payback ----
    const daysActive = business.metrics.length > 0
      ? Math.max(1, business.metrics[0].gameDay)
      : 1;
    const avgDailyProfit = business.totalProfit / daysActive;
    const roi = calculateROI({
      investment: businessType.investment,
      cumulativeProfit: business.totalProfit,
      averageDailyProfit: avgDailyProfit,
      daysActive,
    });

    // ---- Product Performance ----
    const productPerformance: ProductPerformance[] = business.inventories.map(inv => {
      const prodConfig = getProductDemandConfig(inv.productName);
      const markup = inv.purchasePrice > 0
        ? (inv.sellPrice - inv.purchasePrice) / inv.purchasePrice
        : 0;
      const priceScore = Math.max(0, Math.min(1, 1 - Math.abs(markup - (businessType.id === 'TEA_STALL' ? 0.6 : 0.3))));

      // Estimate demand level based on price vs market
      const demandMultiplier = 1; // Would need market data for precise calc
      const demandScore = classifyDemandLevel(demandMultiplier * (markup < 0.5 ? 1.2 : markup < 1.0 ? 1.0 : 0.7));

      return {
        productName: inv.productName,
        category: inv.category,
        quantitySold: 0, // Not tracked per-product daily yet — would need separate tracking
        revenue: 0,
        costOfGoodsSold: 0,
        grossProfit: 0,
        profitMargin: markup,
        remainingStock: inv.quantity,
        demandScore,
        priceScore,
      };
    });

    // ---- Financial Breakdown ----
    const financialBreakdown = {
      revenue: Math.round(business.dailyRevenue),
      costOfGoodsSold: Math.round(dailyCOGS),
      grossProfit: Math.round(grossProfit),
      rent: 0, // Would need expense breakdown stored
      salaries: 0,
      utilities: 0,
      taxes: 0,
      netProfit: Math.round(business.dailyProfit),
      customers: business.dailyCustomers || 0,
      reputation: Math.round(business.reputation * 10) / 10,
    };

    // ---- Demand Indicators ----
    const demandIndicators: Record<string, { level: DemandLevel; trend: DemandTrend }> = {};
    for (const inv of business.inventories) {
      const prodConfig = getProductDemandConfig(inv.productName);
      const markup = inv.purchasePrice > 0 ? inv.sellPrice / inv.purchasePrice - 1 : 0;
      const level = classifyDemandLevel(markup < 0.5 ? 1.3 : markup < 1.0 ? 1.0 : 0.7);
      let trend: DemandTrend = 'STABLE';
      if (business.metrics.length >= 2) {
        const recent = business.metrics[0].revenue;
        const prev = business.metrics[1].revenue;
        const change = prev > 0 ? (recent - prev) / prev : 0;
        trend = change > 0.05 ? 'RISING' : change < -0.05 ? 'FALLING' : 'STABLE';
      }
      demandIndicators[inv.productName] = { level, trend };
    }

    // ---- History (for charts) ----
    const history = business.metrics.map(m => ({
      gameDay: m.gameDay,
      revenue: Math.round(m.revenue),
      expenses: Math.round(m.expenses),
      profit: Math.round(m.profit),
      customers: m.customers,
      reputation: Math.round(m.reputation * 10) / 10,
    })).reverse(); // Oldest first for charts

    const analytics: BusinessAnalytics = {
      summary,
      health,
      roi,
      productPerformance,
      financialBreakdown,
      demandIndicators,
    };

    return successResponse({
      ...analytics,
      history,
      businessName: business.name,
      businessType: businessType.name,
      level: business.level,
      totalRevenue: Math.round(business.totalRevenue),
      totalProfit: Math.round(business.totalProfit),
      healthScore: business.healthScore,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
