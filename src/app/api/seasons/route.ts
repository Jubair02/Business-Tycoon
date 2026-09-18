// ============================================
// Seasons
// GET /api/seasons          — the active season, plus this account's record
// ============================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/errors';
import { resolveSession } from '@/lib/auth/user-session';
import { getSeasonSummary } from '@/lib/game/seasons/seasons';
import { prestigeTier, BADGES } from '@/lib/game/seasons/season-config';

export async function GET() {
  try {
    const season = await getSeasonSummary();
    const sessionInfo = await resolveSession();

    if (!sessionInfo?.userId) {
      return NextResponse.json({ season, account: null });
    }

    const user = await db.user.findUnique({
      where: { id: sessionInfo.userId },
      select: {
        prestige: true,
        seasonsPlayed: true,
        bestRank: true,
        lifetimeNetWorth: true,
        archives: {
          orderBy: { createdAt: 'desc' },
          select: {
            seasonId: true,
            playerName: true,
            finalNetWorth: true,
            finalRank: true,
            businessCount: true,
            totalProfit: true,
            daysPlayed: true,
            prestigeEarned: true,
            badges: true,
            season: { select: { number: true, name: true, lengthDays: true } },
          },
        },
      },
    });

    if (!user) return NextResponse.json({ season, account: null });

    // Badge ids are stored, not labels, so past seasons are not rewritten when
    // the wording changes — or when the UI is translated.
    const earnedBadgeIds = new Set<string>();
    const history = user.archives.map(archive => {
      let badges: string[] = [];
      try {
        const parsed = JSON.parse(archive.badges);
        if (Array.isArray(parsed)) badges = parsed.filter((b): b is string => typeof b === 'string');
      } catch {
        // A malformed row should cost that season its badges, not the response.
      }
      badges.forEach(id => earnedBadgeIds.add(id));

      return {
        seasonNumber: archive.season.number,
        seasonName: archive.season.name,
        playerName: archive.playerName,
        finalNetWorth: archive.finalNetWorth,
        finalRank: archive.finalRank,
        businessCount: archive.businessCount,
        totalProfit: archive.totalProfit,
        daysPlayed: archive.daysPlayed,
        seasonLengthDays: archive.season.lengthDays,
        prestigeEarned: archive.prestigeEarned,
        badges,
      };
    });

    return NextResponse.json({
      season,
      account: {
        prestige: user.prestige,
        tier: prestigeTier(user.prestige),
        seasonsPlayed: user.seasonsPlayed,
        bestRank: user.bestRank,
        lifetimeNetWorth: user.lifetimeNetWorth,
        badges: [...earnedBadgeIds].map(id => BADGES[id]).filter(Boolean),
        history,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
