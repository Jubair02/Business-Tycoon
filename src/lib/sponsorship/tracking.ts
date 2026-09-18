// ============================================
// Bangladesh Business Tycoon - Sponsorship Tracking
// ============================================
//
// Counting, and only counting. The rules about which brand fills which slot are
// in `placements.ts`.
//
// The shape here is a per-tick ledger accumulated in memory and flushed once at
// the end of the day. That is what keeps this affordable: a game day is a real
// minute, so a row per impression would be millions of rows a week to answer a
// question that a daily total answers exactly as well — and a partner report is
// a daily report.
//
// It is also what makes "unique accounts" honest. The tick walks each business
// once per day, so distinct owners can be counted exactly within the day rather
// than approximated from a counter.

import { db } from '@/lib/db';
import {
  eligiblePlacements,
  isSponsorActive,
  selectPlacement,
  type PlacementKind,
  type PlacementRef,
  type SponsorRef,
} from './placements';

export interface LiveSponsorship {
  sponsors: Map<string, SponsorRef>;
  placements: PlacementRef[];
}

const EMPTY: LiveSponsorship = { sponsors: new Map(), placements: [] };

/**
 * Load the campaigns that are live right now.
 *
 * Fetched once per tick and passed around, in the same way as events and market
 * prices — a per-business query would mean one round trip per shop per minute
 * for data that is identical across all of them.
 */
export async function loadLiveSponsorships(now: Date = new Date()): Promise<LiveSponsorship> {
  const sponsors = await db.sponsor.findMany({
    where: { status: 'ACTIVE' },
    include: { placements: true },
  });

  const live = sponsors.filter(s => isSponsorActive(s as SponsorRef, now));
  if (live.length === 0) return EMPTY;

  return {
    sponsors: new Map(live.map(s => [s.id, s as SponsorRef])),
    placements: live.flatMap(s =>
      s.placements.map(p => ({
        id: p.id,
        sponsorId: p.sponsorId,
        kind: p.kind as PlacementKind,
        label: p.label,
        targetRef: p.targetRef,
        weight: p.weight,
      })),
    ),
  };
}

/** What one placement accrued on one day, before it is written. */
interface LedgerEntry {
  impressions: number;
  engagements: number;
  /** Accounts, so "unique" means unique rather than "counted once per shop". */
  users: Set<string>;
}

/**
 * A day's sponsorship counts, held in memory until the tick flushes them.
 */
export class SponsorshipLedger {
  private readonly entries = new Map<string, LedgerEntry>();

  constructor(
    private readonly live: LiveSponsorship,
    private readonly gameDay: number,
  ) {}

  get isEmpty(): boolean {
    return this.entries.size === 0;
  }

  /**
   * The brand filling a slot, or null when nobody has bought it.
   *
   * The seed fixes the answer for the day, so a shelf does not change sponsor
   * between two page loads.
   */
  placementFor(kind: PlacementKind, targetRef: string | null, slotKey: string): PlacementRef | null {
    if (this.live.placements.length === 0) return null;
    const candidates = eligiblePlacements(this.live.placements, kind, targetRef);
    if (candidates.length === 0) return null;
    return selectPlacement(candidates, `${slotKey}:${this.gameDay}`);
  }

  sponsorFor(placement: PlacementRef): SponsorRef | undefined {
    return this.live.sponsors.get(placement.sponsorId);
  }

  /**
   * Record that an account saw a placement, and optionally acted on it.
   *
   * "Seen" means the player's shop actually stocked and displayed the branded
   * line that day — not that a pixel was requested. "Engaged" means they bought
   * or sold it. Both are things the server observes directly, which is why
   * neither depends on a client beacon that an ad blocker would eat.
   */
  record(placementId: string, userId: string | null, engaged = false): void {
    const entry = this.entries.get(placementId) ?? { impressions: 0, engagements: 0, users: new Set() };
    entry.impressions += 1;
    if (engaged) entry.engagements += 1;
    if (userId) entry.users.add(userId);
    this.entries.set(placementId, entry);
  }

  /**
   * Write the day's counts.
   *
   * Upserted per placement per day and incremented, so a tick that runs twice
   * for a day — a retry, a second process — adds rather than overwrites, and a
   * flush that fails takes nothing else down with it.
   */
  async flush(): Promise<void> {
    if (this.entries.size === 0) return;

    const placementSponsor = new Map(this.live.placements.map(p => [p.id, p.sponsorId]));

    for (const [placementId, entry] of this.entries) {
      const sponsorId = placementSponsor.get(placementId);
      if (!sponsorId) continue;

      try {
        await db.sponsorDailyStat.upsert({
          where: { placementId_gameDay: { placementId, gameDay: this.gameDay } },
          create: {
            sponsorId,
            placementId,
            gameDay: this.gameDay,
            impressions: entry.impressions,
            engagements: entry.engagements,
            uniqueUsers: entry.users.size,
          },
          update: {
            impressions: { increment: entry.impressions },
            engagements: { increment: entry.engagements },
            // Unique accounts cannot be summed across two flushes of the same
            // day without double-counting, so the larger figure wins.
            uniqueUsers: Math.max(entry.users.size, 0),
          },
        });
      } catch (error) {
        console.error(`[sponsorship] Failed to record stats for placement ${placementId}:`, error);
      }
    }

    this.entries.clear();
  }
}

/** A ledger for this tick, or a dormant one when nobody has bought anything. */
export async function openLedger(gameDay: number): Promise<SponsorshipLedger> {
  const live = await loadLiveSponsorships();
  return new SponsorshipLedger(live, gameDay);
}
