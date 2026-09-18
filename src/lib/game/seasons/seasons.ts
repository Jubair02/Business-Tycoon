// ============================================
// Bangladesh Business Tycoon - Season Lifecycle
// ============================================
//
// Owns the active season: finding it, advancing its clock, ending it, and
// opening the next one. Everything that used to read `GameState.gameDay` reads
// `getCurrentGameDay()` instead — the day now belongs to a season rather than
// to the world, which is what makes sharding and a fresh ladder possible.
//
// `GameState` is still the world-level key-value store, but only for things
// that genuinely are world-level: the tick lock and the seed version.

import { db } from '@/lib/db';
import {
  SEASON_CONFIG,
  seasonName,
  calculatePrestige,
  awardSeasonBadges,
  isSeasonOver,
  daysRemaining,
  seasonProgress,
  type SeasonResult,
} from './season-config';

export interface ActiveSeason {
  id: string;
  number: number;
  name: string;
  gameDay: number;
  lengthDays: number;
  tickCount: number;
  lastTickAt: Date | null;
  startedAt: Date | null;
}

/** The season currently being played, or null before the first bootstrap. */
export async function getActiveSeason(): Promise<ActiveSeason | null> {
  const season = await db.season.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { number: 'desc' },
    select: {
      id: true, number: true, name: true, gameDay: true,
      lengthDays: true, tickCount: true, lastTickAt: true, startedAt: true,
    },
  });
  return season;
}

/**
 * The active season, opening season 1 if the world has never had one.
 *
 * Also adopts any pre-season save into season 1 rather than stranding it: an
 * existing database has players with `seasonId = null`, and they should find
 * their empire where they left it rather than an empty game.
 */
export async function ensureActiveSeason(): Promise<ActiveSeason> {
  const existing = await getActiveSeason();
  if (existing) return existing;

  // A season may exist but not be active yet (UPCOMING), e.g. created by a
  // rollover that has not started it.
  const upcoming = await db.season.findFirst({
    where: { status: 'UPCOMING' },
    orderBy: { number: 'asc' },
  });

  if (upcoming) {
    const started = await db.season.update({
      where: { id: upcoming.id },
      data: { status: 'ACTIVE', startedAt: new Date() },
      select: {
        id: true, number: true, name: true, gameDay: true,
        lengthDays: true, tickCount: true, lastTickAt: true, startedAt: true,
      },
    });
    return started;
  }

  const highest = await db.season.findFirst({ orderBy: { number: 'desc' }, select: { number: true } });
  const number = (highest?.number ?? 0) + 1;

  // Carry the pre-season world clock into season 1 so an existing database does
  // not appear to jump back to day 1 underneath its players.
  let gameDay = 0;
  if (number === 1) {
    const legacyDay = await db.gameState.findUnique({ where: { key: 'gameDay' } });
    gameDay = Math.max(0, parseInt(legacyDay?.value || '0', 10));
  }

  const season = await db.season.create({
    data: {
      number,
      name: seasonName(number),
      status: 'ACTIVE',
      lengthDays: SEASON_CONFIG.lengthDays,
      gameDay,
      startedAt: new Date(),
    },
    select: {
      id: true, number: true, name: true, gameDay: true,
      lengthDays: true, tickCount: true, lastTickAt: true, startedAt: true,
    },
  });

  // Adopt orphaned saves from before seasons existed.
  await db.player.updateMany({
    where: { seasonId: null },
    data: { seasonId: season.id },
  });

  return season;
}

/**
 * The current game day.
 *
 * The drop-in replacement for the old `GameState.gameDay` read. Returns 1 for a
 * world with no season yet, matching the previous default, so a caller running
 * before the first bootstrap behaves as it always did.
 */
export async function getCurrentGameDay(): Promise<number> {
  const season = await getActiveSeason();
  return season?.gameDay ?? 1;
}

/** Advance the active season by a day and report where that leaves it. */
export async function advanceSeasonDay(): Promise<{
  season: ActiveSeason;
  gameDay: number;
  finished: boolean;
}> {
  const season = await ensureActiveSeason();

  const updated = await db.season.update({
    where: { id: season.id },
    data: {
      gameDay: { increment: 1 },
      tickCount: { increment: 1 },
      lastTickAt: new Date(),
    },
    select: {
      id: true, number: true, name: true, gameDay: true,
      lengthDays: true, tickCount: true, lastTickAt: true, startedAt: true,
    },
  });

  return {
    season: updated,
    gameDay: updated.gameDay,
    finished: isSeasonOver(updated.gameDay, updated.lengthDays),
  };
}

export interface SeasonStanding {
  playerId: string;
  userId: string | null;
  name: string;
  netWorth: number;
  level: number;
  businessCount: number;
  totalProfit: number;
  daysPlayed: number;
  isAI: boolean;
}

/**
 * Final standings for a season, best first.
 *
 * AI competitors are ranked alongside humans — they play the same economy, and
 * a board that hid them would overstate how well the humans did.
 */
export async function getSeasonStandings(seasonId: string): Promise<SeasonStanding[]> {
  const players = await db.player.findMany({
    where: { seasonId },
    orderBy: { netWorth: 'desc' },
    select: {
      id: true,
      userId: true,
      name: true,
      netWorth: true,
      level: true,
      isAI: true,
      lastSeenGameDay: true,
      businesses: { select: { totalProfit: true } },
    },
  });

  return players.map(p => ({
    playerId: p.id,
    userId: p.userId,
    name: p.name,
    netWorth: p.netWorth,
    level: p.level,
    businessCount: p.businesses.length,
    totalProfit: p.businesses.reduce((sum, b) => sum + b.totalProfit, 0),
    // AI are present every day by definition; a human's presence is what the
    // offline system has been recording all season.
    daysPlayed: p.isAI ? Number.MAX_SAFE_INTEGER : p.lastSeenGameDay,
    isAI: p.isAI,
  }));
}

export interface SeasonRolloverResult {
  endedSeasonNumber: number;
  newSeasonNumber: number;
  archived: number;
}

/**
 * Close the active season and open the next one.
 *
 * Every account that played gets an archive row, prestige and badges; the
 * account keeps those forever. The save rows themselves stay attached to the
 * closed season — they are what the read-only archive view reads — and the
 * account simply has no save in the new season until it next signs in, at which
 * point `ensurePlayerForActiveSeason` hands it a fresh ৳500,000.
 *
 * Idempotent: a second call finds no ACTIVE season and does nothing, so a
 * retried tick cannot end the same season twice.
 */
export async function rollOverSeason(): Promise<SeasonRolloverResult | null> {
  const season = await db.season.findFirst({ where: { status: 'ACTIVE' } });
  if (!season) return null;

  const standings = await getSeasonStandings(season.id);

  // Humans only for the permanent record: an AI has no account to credit.
  const humanStandings = standings.filter(s => !s.isAI && s.userId);
  const totalRanked = standings.length;

  let archived = 0;

  for (const standing of humanStandings) {
    // Rank against the whole field, AI included — that is the board the player
    // was actually competing on.
    const finalRank = standings.findIndex(s => s.playerId === standing.playerId) + 1;

    const result: SeasonResult & { seasonNumber: number } = {
      finalNetWorth: standing.netWorth,
      finalRank,
      totalRanked,
      businessCount: standing.businessCount,
      totalProfit: standing.totalProfit,
      daysPlayed: Math.min(standing.daysPlayed, season.lengthDays),
      seasonLengthDays: season.lengthDays,
      seasonNumber: season.number,
    };

    const prestigeEarned = calculatePrestige(result);
    const badges = awardSeasonBadges(result);

    try {
      await db.$transaction(async tx => {
        await tx.seasonArchive.upsert({
          where: { userId_seasonId: { userId: standing.userId!, seasonId: season.id } },
          create: {
            userId: standing.userId!,
            seasonId: season.id,
            playerName: standing.name,
            finalNetWorth: standing.netWorth,
            finalRank,
            businessCount: standing.businessCount,
            totalProfit: standing.totalProfit,
            daysPlayed: result.daysPlayed,
            finalLevel: standing.level,
            prestigeEarned,
            badges: JSON.stringify(badges),
          },
          update: {},
        });

        const user = await tx.user.findUnique({
          where: { id: standing.userId! },
          select: { prestige: true, bestRank: true },
        });

        await tx.user.update({
          where: { id: standing.userId! },
          data: {
            prestige: Math.min(SEASON_CONFIG.maxPrestige, (user?.prestige ?? 0) + prestigeEarned),
            seasonsPlayed: { increment: 1 },
            lifetimeNetWorth: { increment: standing.netWorth },
            bestRank:
              user?.bestRank == null || finalRank < user.bestRank ? finalRank : user.bestRank,
          },
        });
      });
      archived++;
    } catch (error) {
      // One account failing to archive must not strand the whole rollover; the
      // season still has to close or the world stops.
      console.error(`[Seasons] Failed to archive user ${standing.userId}:`, error);
    }
  }

  await db.season.update({
    where: { id: season.id },
    data: { status: 'ENDED', endedAt: new Date() },
  });

  const next = await db.season.create({
    data: {
      number: season.number + 1,
      name: seasonName(season.number + 1),
      status: 'ACTIVE',
      lengthDays: SEASON_CONFIG.lengthDays,
      gameDay: 0,
      startedAt: new Date(),
    },
  });

  await db.gameLog.create({
    data: {
      type: 'SEASON_ENDED',
      message:
        `${season.name} has ended after ${season.gameDay} days. ` +
        `${archived} owner${archived === 1 ? '' : 's'} archived. ${next.name} begins now.`,
    },
  });

  return {
    endedSeasonNumber: season.number,
    newSeasonNumber: next.number,
    archived,
  };
}

/** Shape the client needs to render the season banner and countdown. */
export async function getSeasonSummary() {
  const season = await getActiveSeason();
  if (!season) return null;

  return {
    id: season.id,
    number: season.number,
    name: season.name,
    gameDay: season.gameDay,
    lengthDays: season.lengthDays,
    daysRemaining: daysRemaining(season.gameDay, season.lengthDays),
    progress: seasonProgress(season.gameDay, season.lengthDays),
    startedAt: season.startedAt,
  };
}
