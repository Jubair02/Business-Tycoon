// ============================================
// Bangladesh Business Tycoon - Seasonal demand
// ============================================
//
// What the calendar does to trade. A clothing shop that does not feel the last
// ten days of Ramadan is not a shop in Bangladesh.
//
// ---- The constraint that shapes this whole module ----
//
// `INVARIANTS.md` U2 records that `simulateBusinessTick` already multiplies
// seven modifiers onto base demand, that each was verified in isolation, and
// that together they suppress a shop's custom by roughly twelve times. This is
// an eighth. Added carelessly it would make that worse and would break E1, the
// 25-45 day payback band every business type is solved to.
//
// So it is built to be **mean-neutral over a year, by construction**:
//
//   multiplier(day) = raw(day) / mean(raw over the whole year)
//
// The annual mean is therefore exactly 1.0 for every trade, and the calendar
// *redistributes* a year's custom rather than adding any. Eid is a real spike
// because Borsha is a real trough, which is how the actual retail year works.
// A test asserts the mean, and the balance test asserts the payback band still
// holds with this applied.
//
// This is what makes an eighth modifier safe to add to a chain that is already
// known to be over-suppressed: it cannot move the annual total at all.

import { addDays, daysBetween, partsOf, type CivilDate } from './civil-date';
import { bengaliDateOf } from './bengali';
import { observancesBetween, MAX_LEAD_DAYS, MAX_TRAIL_DAYS } from './calendar';
import { SEASONAL_EFFECTS, type DemandWindow, type TradeId } from './observances';

/**
 * No single day may swing further than this.
 *
 * Applied to the raw curve *before* normalising, so the mean stays exactly 1.0.
 * Clamping afterwards would quietly reintroduce the bias this module exists to
 * avoid.
 */
export const DEMAND_BOUNDS = { min: 0.2, max: 3.0 } as const;

/**
 * How front-loaded a ramp is.
 *
 * Squared rather than linear because Eid shopping is not spread evenly across
 * the month — the last ten days of Ramadan carry most of it, and a linear ramp
 * would put custom in the shop three weeks early when the shelves are still
 * being stocked.
 */
const RAMP_EXPONENT = 2;

/** Where a day sits inside one demand window. 1.0 when the window is not open. */
export function windowMultiplier(window: DemandWindow, offsetDays: number): number {
  const from = Math.min(window.from, window.to);
  const to = Math.max(window.from, window.to);
  if (offsetDays < from || offsetDays > to) return 1;

  if (window.shape === 'flat' || from === to) return window.peak;

  const peakAt = window.peakAt ?? to;
  if (peakAt === from) return window.peak;

  const progress = Math.max(0, Math.min(1, (offsetDays - from) / (peakAt - from)));
  return 1 + (window.peak - 1) * progress ** RAMP_EXPONENT;
}

export interface DemandFactor {
  /** Observance id, or `season:SHEET`. */
  source: string;
  label: string;
  labelBn: string;
  multiplier: number;
}

/**
 * Every effect acting on a day, before normalisation.
 *
 * Exported because the shop screen shows this: an unexplained 1.8x is noise,
 * "Eid-ul-Fitr rush x1.8" is information a player can act on.
 */
export function demandFactorsOn(day: CivilDate, trade: TradeId): DemandFactor[] {
  const factors: DemandFactor[] = [];

  // Observances whose windows can reach this day, in either direction.
  const nearby = observancesBetween(
    addDays(day, -MAX_TRAIL_DAYS),
    addDays(day, MAX_LEAD_DAYS),
  );

  for (const resolved of nearby) {
    const offset = daysBetween(resolved.date, day);

    let combined = 1;
    for (const window of resolved.observance.demand) {
      if (window.trade !== 'ALL' && window.trade !== trade) continue;
      combined *= windowMultiplier(window, offset);
    }

    if (combined !== 1) {
      factors.push({
        source: resolved.observance.id,
        label: resolved.observance.en,
        labelBn: resolved.observance.bn,
        multiplier: combined,
      });
    }
  }

  // The season the day sits in — the weather a shop trades in, not an event.
  const season = bengaliDateOf(day).season;
  for (const effect of SEASONAL_EFFECTS) {
    if (effect.season !== season.id) continue;
    if (effect.trade !== 'ALL' && effect.trade !== trade) continue;
    factors.push({
      source: `season:${effect.season}`,
      label: `${season.en} — ${effect.note}`,
      labelBn: season.bn,
      multiplier: effect.multiplier,
    });
  }

  return factors;
}

/** The unnormalised curve, clamped. */
export function rawSeasonalMultiplier(day: CivilDate, trade: TradeId): number {
  const product = demandFactorsOn(day, trade).reduce((acc, f) => acc * f.multiplier, 1);
  return Math.min(DEMAND_BOUNDS.max, Math.max(DEMAND_BOUNDS.min, product));
}

// ============================================
// Normalisation
// ============================================

const annualMeans = new Map<string, number>();

/**
 * The mean of the raw curve across a Gregorian year.
 *
 * Cached: this walks 365 days and is called from the tick, which runs once a
 * real minute for every trading shop in the world.
 */
export function annualMeanMultiplier(gregorianYear: number, trade: TradeId): number {
  const key = `${gregorianYear}:${trade}`;
  const cached = annualMeans.get(key);
  if (cached !== undefined) return cached;

  let total = 0;
  let days = 0;
  let day: CivilDate = `${gregorianYear}-01-01`;

  while (partsOf(day).year === gregorianYear) {
    total += rawSeasonalMultiplier(day, trade);
    days++;
    day = addDays(day, 1);
  }

  const mean = days > 0 ? total / days : 1;
  annualMeans.set(key, mean);
  return mean;
}

/**
 * What the calendar does to demand on a day. **Annual mean is exactly 1.0.**
 *
 * This is the number the tick multiplies in.
 */
export function seasonalDemandMultiplier(day: CivilDate, trade: TradeId): number {
  const mean = annualMeanMultiplier(partsOf(day).year, trade);
  if (!Number.isFinite(mean) || mean <= 0) return 1;

  const value = rawSeasonalMultiplier(day, trade) / mean;
  // A non-finite multiplier would poison net worth and every figure downstream.
  return Number.isFinite(value) ? value : 1;
}

export interface SeasonalDemand {
  multiplier: number;
  factors: DemandFactor[];
  /** Above 1 means better than an average day for this trade. */
  betterThanAverage: boolean;
}

/** The multiplier plus the reasons for it, for display. */
export function seasonalDemandFor(day: CivilDate, trade: TradeId): SeasonalDemand {
  const multiplier = seasonalDemandMultiplier(day, trade);
  return {
    multiplier,
    factors: demandFactorsOn(day, trade),
    betterThanAverage: multiplier > 1,
  };
}

/** Test seam: the cache would otherwise hide a change to the catalogue. */
export function __clearSeasonalCache(): void {
  annualMeans.clear();
}
