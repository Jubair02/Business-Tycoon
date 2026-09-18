// ============================================
// Bangladesh Business Tycoon - Brand Sponsorship
// ============================================
//
// A sponsored brand appears *inside* the world: a branded line on a shelf, a
// branded event, a billboard on the dashboard. Not an interstitial, not a
// rewarded video for a real product. For a game whose whole positioning is
// authenticity — real cities, real trades, real prices — an interstitial would
// cost more credibility than it earns, and credibility is the only thing that
// makes this inventory worth more than a banner farm.
//
// The pure half lives here: which placement fills a slot, whether a campaign is
// live, and how a partner report is assembled. Counting and persistence are in
// `tracking.ts`.

export type PlacementKind = 'PRODUCT' | 'EVENT' | 'BILLBOARD';

export interface SponsorRef {
  id: string;
  name: string;
  slug: string;
  brandColor: string;
  logoUrl: string | null;
  status: string;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
}

export interface PlacementRef {
  id: string;
  sponsorId: string;
  kind: PlacementKind;
  label: string;
  targetRef: string | null;
  weight: number;
}

/**
 * Whether a campaign is live right now.
 *
 * A missing date means "no bound on that end" rather than "never" — a partner
 * signing an open-ended pilot should not have to invent an end date.
 */
export function isSponsorActive(sponsor: SponsorRef, now: Date = new Date()): boolean {
  if (sponsor.status !== 'ACTIVE') return false;

  const at = now.getTime();

  if (sponsor.startsAt) {
    const starts = new Date(sponsor.startsAt).getTime();
    if (Number.isFinite(starts) && at < starts) return false;
  }
  if (sponsor.endsAt) {
    const ends = new Date(sponsor.endsAt).getTime();
    if (Number.isFinite(ends) && at > ends) return false;
  }

  return true;
}

/**
 * Pick a placement for a slot, weighted by each sponsor's share.
 *
 * Deterministic for a given seed, which matters more than it looks: a shelf
 * whose sponsor changed every time the page re-rendered would read as a bug,
 * and a partner's impression count would depend on how often a player scrolled.
 * Seeding on (slot, game day) means the same slot shows the same brand all day.
 */
export function selectPlacement(
  placements: PlacementRef[],
  seed: string,
): PlacementRef | null {
  const eligible = placements.filter(p => p.weight > 0);
  if (eligible.length === 0) return null;

  const totalWeight = eligible.reduce((sum, p) => sum + p.weight, 0);
  const point = hashToUnitInterval(seed) * totalWeight;

  let cursor = 0;
  for (const placement of eligible) {
    cursor += placement.weight;
    if (point < cursor) return placement;
  }

  return eligible[eligible.length - 1];
}

/**
 * A small, stable string hash mapped into [0, 1).
 *
 * FNV-1a: not cryptographic, and does not need to be — it only has to spread
 * evenly and give the same answer on every server.
 */
export function hashToUnitInterval(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash / 0x100000000;
}

/** Placements that could fill a slot of this kind for this target. */
export function eligiblePlacements(
  placements: PlacementRef[],
  kind: PlacementKind,
  targetRef?: string | null,
): PlacementRef[] {
  return placements.filter(p => {
    if (p.kind !== kind) return false;
    // A placement with no target is a wildcard: it fits any slot of its kind.
    if (!p.targetRef) return true;
    return targetRef != null && p.targetRef === targetRef;
  });
}

// ============================================
// Partner reporting
// ============================================

export interface DailyStat {
  gameDay: number;
  placementId: string;
  impressions: number;
  engagements: number;
  uniqueUsers: number;
}

export interface PartnerReport {
  totalImpressions: number;
  totalEngagements: number;
  /** Peak distinct accounts reached on any one day — the honest "reach" number. */
  peakDailyReach: number;
  /** Engagements per impression, 0-1. */
  engagementRate: number;
  daysReported: number;
  byDay: { gameDay: number; impressions: number; engagements: number; uniqueUsers: number }[];
  byPlacement: { placementId: string; impressions: number; engagements: number }[];
}

/**
 * Assemble the report a brand actually gets.
 *
 * Reach is reported as the peak of the daily distinct-account counts, not their
 * sum: the same player seen on ten days is one person, and summing would
 * overstate reach tenfold. Overstating reach to a partner is the fastest way to
 * lose the second campaign, and this is a pilot whose point is the second
 * campaign.
 */
export function buildPartnerReport(stats: DailyStat[]): PartnerReport {
  if (stats.length === 0) {
    return {
      totalImpressions: 0,
      totalEngagements: 0,
      peakDailyReach: 0,
      engagementRate: 0,
      daysReported: 0,
      byDay: [],
      byPlacement: [],
    };
  }

  const byDayMap = new Map<number, { impressions: number; engagements: number; uniqueUsers: number }>();
  const byPlacementMap = new Map<string, { impressions: number; engagements: number }>();

  for (const stat of stats) {
    const day = byDayMap.get(stat.gameDay) ?? { impressions: 0, engagements: 0, uniqueUsers: 0 };
    day.impressions += stat.impressions;
    day.engagements += stat.engagements;
    // Distinct accounts do not add up across placements either — the same
    // player may have seen two of them — so the day's reach is the largest
    // single placement's, which cannot overstate it.
    day.uniqueUsers = Math.max(day.uniqueUsers, stat.uniqueUsers);
    byDayMap.set(stat.gameDay, day);

    const placement = byPlacementMap.get(stat.placementId) ?? { impressions: 0, engagements: 0 };
    placement.impressions += stat.impressions;
    placement.engagements += stat.engagements;
    byPlacementMap.set(stat.placementId, placement);
  }

  const byDay = [...byDayMap.entries()]
    .map(([gameDay, values]) => ({ gameDay, ...values }))
    .sort((a, b) => a.gameDay - b.gameDay);

  const totalImpressions = byDay.reduce((sum, d) => sum + d.impressions, 0);
  const totalEngagements = byDay.reduce((sum, d) => sum + d.engagements, 0);

  return {
    totalImpressions,
    totalEngagements,
    peakDailyReach: byDay.reduce((max, d) => Math.max(max, d.uniqueUsers), 0),
    engagementRate: totalImpressions > 0 ? totalEngagements / totalImpressions : 0,
    daysReported: byDay.length,
    byDay,
    byPlacement: [...byPlacementMap.entries()]
      .map(([placementId, values]) => ({ placementId, ...values }))
      .sort((a, b) => b.impressions - a.impressions),
  };
}
