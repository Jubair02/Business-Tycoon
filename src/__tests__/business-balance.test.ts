// ============================================
// Bangladesh Business Tycoon - Business Balance Guard
// ============================================
//
// Before this suite existed, Clothing paid back its investment in 18 days and
// Restaurant took 148 — an eight-fold spread that made two of the five types
// strictly dominated and therefore dead content. The five configs are now
// solved against a target band, and this file is what keeps them there.
//
// These are *balance* assertions, not formula assertions: they run the shipped
// economy end to end through `balance-sim.ts` and judge the result. If one
// fails after a data change, re-run the simulation and re-solve the config
// rather than widening the band.
//
// The band describes an *uncontested* market. `balance-sim.ts` models one shop
// on an empty street; a shop facing rivals earns its share of the trade rather
// than all of it (see `economy/competition.ts`), so a contested payback is
// longer than the numbers here by design. The band is the ceiling on how well a
// type can do, and it is the ceilings that have to be comparable.

import { describe, it, expect } from 'vitest';
import { simulateBusinessDays } from '@/lib/game/economy/balance-sim';
import { BUSINESS_TYPES, PRODUCTS } from '@/lib/game-data';
import { BUSINESS_ECONOMY_CONFIG } from '@/lib/game/economy/business-config';

/** The band every business type has to pay back inside. */
const MIN_PAYBACK_DAYS = 25;
const MAX_PAYBACK_DAYS = 45;

/**
 * Averaged over enough runs that day-to-day volatility does not decide the
 * verdict. Each run is a fresh 120-day simulation in Dhaka at level 1.
 */
function steadyState(businessTypeId: string) {
  const runs = Array.from({ length: 10 }, () => simulateBusinessDays(businessTypeId, 'DHAKA', 120));
  const mean = (pick: (r: (typeof runs)[number]) => number) =>
    runs.reduce((sum, r) => sum + pick(r), 0) / runs.length;

  const investment = runs[0].investment;
  const netPerDay = mean(r => r.averageProfit);

  // Coefficient of variation across every simulated day. A single worst day is
  // a tail sample and swings run to run; the spread of the whole distribution
  // is what "risk" actually means here, and it is stable.
  const dailyProfits = runs.flatMap(r => r.days.map(d => d.netProfit));
  const variance =
    dailyProfits.reduce((sum, p) => sum + (p - netPerDay) ** 2, 0) / dailyProfits.length;
  const volatility = Math.sqrt(variance) / netPerDay;

  return {
    volatility,
    investment,
    netPerDay,
    revenuePerDay: mean(r => r.averageRevenue),
    cogsPerDay: mean(r => r.averageCOGS),
    paybackDays: investment / netPerDay,
    profitableDayRate: mean(r => r.profitabilityRate),
    worstDay: Math.min(...runs.map(r => r.worstDay.netProfit)),
  };
}

const MEASURED = Object.fromEntries(
  BUSINESS_TYPES.map(bt => [bt.id, steadyState(bt.id)]),
) as Record<string, ReturnType<typeof steadyState>>;

/** Business types cheapest first — the order the player meets them in. */
const BY_INVESTMENT = [...BUSINESS_TYPES].sort((a, b) => a.investment - b.investment);

describe('business balance', () => {
  describe('payback band', () => {
    for (const bt of BUSINESS_TYPES) {
      it(`${bt.name} pays back within ${MIN_PAYBACK_DAYS}-${MAX_PAYBACK_DAYS} days`, () => {
        const { paybackDays } = MEASURED[bt.id];
        expect(paybackDays).toBeGreaterThanOrEqual(MIN_PAYBACK_DAYS);
        expect(paybackDays).toBeLessThanOrEqual(MAX_PAYBACK_DAYS);
      });
    }

    it('no type is more than twice as fast to repay as another', () => {
      const paybacks = BUSINESS_TYPES.map(bt => MEASURED[bt.id].paybackDays);
      // The spread used to be ~8x (Clothing 18 days against Restaurant 148),
      // which is what made the choice of business type a solved problem.
      expect(Math.max(...paybacks) / Math.min(...paybacks)).toBeLessThan(2);
    });
  });

  describe('the ladder', () => {
    it('a bigger investment earns more in absolute taka', () => {
      for (let i = 1; i < BY_INVESTMENT.length; i++) {
        const cheaper = MEASURED[BY_INVESTMENT[i - 1].id];
        const dearer = MEASURED[BY_INVESTMENT[i].id];
        expect(dearer.netPerDay).toBeGreaterThan(cheaper.netPerDay);
      }
    });

    it('a bigger investment earns a slightly worse return on capital', () => {
      // Scale, not ROI, is what progression buys. If the dearest types also had
      // the best ROI there would be no reason to ever run a small shop.
      for (let i = 1; i < BY_INVESTMENT.length; i++) {
        const cheaper = MEASURED[BY_INVESTMENT[i - 1].id];
        const dearer = MEASURED[BY_INVESTMENT[i].id];
        expect(dearer.paybackDays).toBeGreaterThan(cheaper.paybackDays);
      }
    });

    it('every type is profitable on essentially every day when well run', () => {
      for (const bt of BUSINESS_TYPES) {
        expect(MEASURED[bt.id].profitableDayRate).toBeGreaterThanOrEqual(90);
      }
    });
  });

  describe('working capital', () => {
    it('a day of restocking costs less than a third of the investment', () => {
      // Mobile used to turn over 1.1m taka of stock a day on a 1m taka shop,
      // so the business could never fund its own restocking.
      for (const bt of BUSINESS_TYPES) {
        const { cogsPerDay, investment } = MEASURED[bt.id];
        expect(cogsPerDay / investment).toBeLessThan(0.33);
      }
    });
  });

  describe('labels match the simulation', () => {
    it('the type labelled highest risk really does swing the most', () => {
      const ranked = [...BUSINESS_TYPES].sort(
        (a, b) => MEASURED[b.id].volatility - MEASURED[a.id].volatility,
      );
      expect(ranked[0].risk).toBe('High');
      expect(ranked[ranked.length - 1].risk).toBe('Low');
    });

    it('the type labelled lowest profit really does earn the least', () => {
      const leanest = BY_INVESTMENT[0];
      expect(leanest.profit).toBe('Low');
      for (const bt of BUSINESS_TYPES) {
        if (bt.id === leanest.id) continue;
        expect(MEASURED[bt.id].netPerDay).toBeGreaterThan(MEASURED[leanest.id].netPerDay);
      }
    });

    it('the health target each type is judged against is one it can reach', () => {
      // `targetMargin` feeds the health score. Setting it above the margin the
      // type actually achieves marks every well-run business as unhealthy.
      for (const bt of BUSINESS_TYPES) {
        const m = MEASURED[bt.id];
        const achievedMargin = m.netPerDay / m.revenuePerDay;
        expect(achievedMargin).toBeGreaterThanOrEqual(BUSINESS_ECONOMY_CONFIG[bt.id].targetMargin);
      }
    });
  });

  describe('shelf space', () => {
    it('a fully stocked shop is limited by demand, not by its shelves', () => {
      // Stock should bind only when the owner has under-restocked. If maxStock
      // sits below a day's demand, revenue is set by shelf size rather than by
      // customers, which is what let the high-ticket types run away.
      for (const bt of BUSINESS_TYPES) {
        const footfall = bt.baseCustomers * 1.4; // Dhaka, level 1, reputation 50
        for (const product of PRODUCTS[bt.id]) {
          expect(product.maxStock).toBeGreaterThanOrEqual(Math.floor(footfall * product.baseDemand));
        }
      }
    });
  });
});
