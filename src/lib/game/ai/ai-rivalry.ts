// ============================================
// Bangladesh Business Tycoon - AI Rivalry (player awareness)
// ============================================
//
// The AI competitors ran a complete strategy layer — personalities, scored
// actions, pricing strategies — against a world that did not contain the
// player. They restocked, repriced and expanded entirely with reference to
// their own books. A human could open next door, halve their prices and take
// the whole street, and no rival would so much as notice.
//
// This module is the missing input. It gathers what the AI can reasonably be
// said to observe about human-owned shops — what they charge, how well they are
// regarded, what they earn, who works there — and turns that into the three
// reactions the design called for: undercut, open nearby, poach staff.
//
// Everything below the intel-gathering function is pure, so the AI's judgement
// can be tested without a database.

import { db } from '@/lib/db';
import { PRODUCTS } from '@/lib/game-data';
import { calculatePriceIndex } from '../economy/competition';
import { getPersonalityConfig } from './ai-strategy';
import type { AIPersonality } from './types';

/** A human-owned shop as a rival AI sees it. */
export interface RivalShop {
  businessId: string;
  businessName: string;
  playerId: string;
  playerName: string;
  city: string;
  type: string;
  level: number;
  reputation: number;
  dailyProfit: number;
  dailyRevenue: number;
  /** Average shelf price relative to the going retail rate. 1.0 = at market. */
  priceIndex: number;
  employees: { id: string; role: string; name: string; salary: number; skill: number }[];
}

export interface RivalIntel {
  /** Human-owned shops keyed by `${city}:${type}`. */
  byMarket: Record<string, RivalShop[]>;
  /** Every human-owned shop, for market-entry scoring. */
  all: RivalShop[];
}

export const RIVALRY_CONFIG = {
  /** How far under a rival's price an undercut aims, before personality. */
  baseUndercut: 0.06,
  /** The most any personality will undercut by. */
  maxUndercut: 0.2,
  /**
   * Floor on the margin an undercut may leave. Selling below this over cost is
   * a loss the AI is not allowed to talk itself into.
   */
  minMarginOverCost: 0.05,
  /** Salary uplift offered when poaching someone else's employee. */
  poachPremium: 0.3,
  /** An AI will not poach unless it can cover this many days of the new wage. */
  poachCashCoverDays: 60,
  /** Minimum skill worth poaching — nobody headhunts a bad hire. */
  poachMinSkill: 5,
  /** Game days an AI must wait between poaching raids. */
  poachCooldownDays: 6,
} as const;

export function marketKey(city: string, type: string): string {
  return `${city}:${type}`;
}

/**
 * Gather what the AI knows about human-owned shops.
 *
 * Fetched once per tick and shared across every AI player, in the same way as
 * events and market prices — eight AI players must not mean eight scans of the
 * player's estate.
 */
export async function buildRivalIntel(): Promise<RivalIntel> {
  const businesses = await db.business.findMany({
    where: {
      player: { isAI: false },
      setupDaysRemaining: 0,
      dormantSinceDay: null,
    },
    select: {
      id: true,
      name: true,
      city: true,
      type: true,
      level: true,
      reputation: true,
      dailyProfit: true,
      dailyRevenue: true,
      playerId: true,
      player: { select: { name: true } },
      inventories: { select: { productName: true, sellPrice: true } },
      employees: { select: { id: true, role: true, name: true, salary: true, skill: true } },
    },
  });

  const all: RivalShop[] = businesses.map(b => ({
    businessId: b.id,
    businessName: b.name,
    playerId: b.playerId,
    playerName: b.player.name,
    city: b.city,
    type: b.type,
    level: b.level,
    reputation: b.reputation,
    dailyProfit: b.dailyProfit,
    dailyRevenue: b.dailyRevenue,
    priceIndex: calculatePriceIndex(b.inventories, PRODUCTS[b.type] || []),
    employees: b.employees,
  }));

  const byMarket: Record<string, RivalShop[]> = {};
  for (const shop of all) {
    const key = marketKey(shop.city, shop.type);
    (byMarket[key] ||= []).push(shop);
  }

  return { byMarket, all };
}

export const EMPTY_RIVAL_INTEL: RivalIntel = { byMarket: {}, all: [] };

/** Human-owned shops trading in the same city and trade as this AI shop. */
export function findRivalsInMarket(intel: RivalIntel, city: string, type: string): RivalShop[] {
  return intel.byMarket[marketKey(city, type)] ?? [];
}

/**
 * How hard this personality plays against the human player.
 *
 * Derived from traits the personalities already declare rather than added as a
 * new hand-tuned dial, so a personality's rivalry stays consistent with the
 * rest of its behaviour: the risk-seeking, price-fiddling ones are the ones
 * that come after you.
 */
export function rivalryDrive(personality: AIPersonality): number {
  const config = getPersonalityConfig(personality);
  return Math.max(0, Math.min(1, config.riskTolerance * 0.6 + config.priceAdjustFrequency * 0.4));
}

/**
 * The price to undercut a rival with, or null if there is no reason to.
 *
 * Aims a personality-scaled step under the cheapest human rival, but never
 * below a floor that would sell stock at a loss, and never above what the AI
 * would have charged anyway — undercutting only ever moves a price down.
 */
export function calculateUndercutPrice(params: {
  /** What the AI's own strategy would have priced this at. */
  intendedPrice: number;
  /** The cheapest price a human rival in this market is charging. */
  rivalPrice: number;
  /** What this stock cost the AI. */
  purchasePrice: number;
  personality: AIPersonality;
}): number | null {
  const { intendedPrice, rivalPrice, purchasePrice, personality } = params;
  if (!Number.isFinite(rivalPrice) || rivalPrice <= 0) return null;

  const drive = rivalryDrive(personality);
  const undercut = Math.min(
    RIVALRY_CONFIG.maxUndercut,
    RIVALRY_CONFIG.baseUndercut + drive * (RIVALRY_CONFIG.maxUndercut - RIVALRY_CONFIG.baseUndercut),
  );

  const target = Math.round(rivalPrice * (1 - undercut));
  const floor = Math.ceil(purchasePrice * (1 + RIVALRY_CONFIG.minMarginOverCost));

  // Undercutting into a loss is not competing, it is losing slowly.
  if (target < floor) return null;

  // If the AI was already cheaper than the rival, leave its own pricing alone.
  if (target >= intendedPrice) return null;

  return target;
}

/** A market worth opening a shop in, from the AI's point of view. */
export interface MarketOpportunity {
  city: string;
  type: string;
  /** Daily profit the human player is taking out of this market. */
  rivalProfit: number;
  rivalCount: number;
  /** Average price index of the human shops here — high means soft prices. */
  rivalPriceIndex: number;
  /** 0-100, higher is a better market to attack. */
  score: number;
}

/**
 * Rank the markets a human player is making money in, as expansion targets.
 *
 * A market is attractive when the player is earning well there (there is trade
 * to take), when their prices are soft (easy to undercut), and when the AI is
 * not already there. Personalities that care little for rivalry score every
 * market near zero, so they keep expanding on their own logic.
 */
export function rankMarketsToAttack(params: {
  intel: RivalIntel;
  personality: AIPersonality;
  /** Markets this AI already trades in, as `city:type` keys. */
  ownedMarkets: string[];
}): MarketOpportunity[] {
  const { intel, personality, ownedMarkets } = params;
  const drive = rivalryDrive(personality);
  const owned = new Set(ownedMarkets);

  const opportunities: MarketOpportunity[] = [];

  for (const [key, shops] of Object.entries(intel.byMarket)) {
    if (shops.length === 0) continue;
    const [city, type] = key.split(':');

    const rivalProfit = shops.reduce((sum, s) => sum + s.dailyProfit, 0);
    const rivalPriceIndex = shops.reduce((sum, s) => sum + s.priceIndex, 0) / shops.length;

    // Only a market someone is actually making money in is worth attacking.
    if (rivalProfit <= 0) continue;

    // Profit is the pull. Scaled so a very rich market does not swamp the rest.
    const profitScore = Math.min(50, Math.log10(1 + rivalProfit) * 14);
    // Soft prices are an opening; a rival already undercutting everyone is not.
    const priceScore = Math.max(-10, Math.min(25, (rivalPriceIndex - 0.95) * 60));
    // Somewhere the AI already trades is a worse target than somewhere new.
    const noveltyScore = owned.has(key) ? -20 : 15;

    const score = Math.max(0, (profitScore + priceScore + noveltyScore) * drive);
    if (score <= 0) continue;

    opportunities.push({
      city,
      type,
      rivalProfit,
      rivalCount: shops.length,
      rivalPriceIndex,
      score,
    });
  }

  return opportunities.sort((a, b) => b.score - a.score);
}

export interface PoachTarget {
  employeeId: string;
  employeeName: string;
  role: string;
  skill: number;
  currentSalary: number;
  /** What the AI must offer to take them. */
  offeredSalary: number;
  fromBusinessId: string;
  fromBusinessName: string;
  fromPlayerId: string;
  fromPlayerName: string;
}

/**
 * Pick someone worth headhunting from a human rival in the same market.
 *
 * The best hand in the market, provided they are actually good, the AI can
 * carry the wage for a while, and the personality is the sort to try it.
 * Returns null — meaning "not this tick" — far more often than not.
 */
export function pickPoachTarget(params: {
  rivals: RivalShop[];
  personality: AIPersonality;
  aiCash: number;
  /** Free employee slots at the AI business doing the hiring. */
  freeSlots: number;
}): PoachTarget | null {
  const { rivals, personality, aiCash, freeSlots } = params;
  if (freeSlots <= 0) return null;

  const drive = rivalryDrive(personality);
  // Only the genuinely combative personalities poach at all.
  if (drive < 0.45) return null;

  const candidates = rivals.flatMap(shop =>
    shop.employees
      .filter(emp => emp.skill >= RIVALRY_CONFIG.poachMinSkill)
      .map(emp => {
        const offeredSalary = Math.round(emp.salary * (1 + RIVALRY_CONFIG.poachPremium));
        return {
          employeeId: emp.id,
          employeeName: emp.name,
          role: emp.role,
          skill: emp.skill,
          currentSalary: emp.salary,
          offeredSalary,
          fromBusinessId: shop.businessId,
          fromBusinessName: shop.businessName,
          fromPlayerId: shop.playerId,
          fromPlayerName: shop.playerName,
        };
      })
      // The AI has to be able to carry the new wage for a couple of months.
      .filter(t => aiCash >= (t.offeredSalary / 30) * RIVALRY_CONFIG.poachCashCoverDays),
  );

  if (candidates.length === 0) return null;

  // Best hand available; ties broken by who is cheapest to take.
  candidates.sort((a, b) => b.skill - a.skill || a.offeredSalary - b.offeredSalary);
  return candidates[0];
}
