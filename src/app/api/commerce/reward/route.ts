// ============================================
// Rewarded video callback
// POST /api/commerce/reward
// ============================================
//
// This is the ad network's *server-side* callback, not the browser's. The
// browser is never trusted to say a video finished: that claim is worth pass
// progress, and anything worth something that the client can assert for free is
// a hole. Every request here must carry the network's signature over the
// transaction id.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/errors';
import { getActiveSeason } from '@/lib/game/seasons/seasons';
import { verifyAdReward, adsEnabled } from '@/lib/commerce/providers';
import { canGrantReward } from '@/lib/commerce/rewards';
import { applyDailyXp, PASS_CONFIG } from '@/lib/commerce/season-pass';

const callbackSchema = z.object({
  userId: z.string().min(1).max(64),
  placement: z.string().min(1).max(64),
  /** The network's own transaction id. Unique, which is what stops replays. */
  transactionId: z.string().min(1).max(128),
});

export async function POST(request: NextRequest) {
  try {
    if (!adsEnabled()) {
      return NextResponse.json({ success: false, reason: 'Rewarded video is not enabled.' }, { status: 503 });
    }

    const body = callbackSchema.parse(await request.json());
    const signature = request.headers.get('x-ad-signature');

    const verified = verifyAdReward({
      userId: body.userId,
      placement: body.placement,
      providerRef: body.transactionId,
      signature,
    });

    // Deliberately terse: an attacker probing this endpoint learns only that it
    // refused, not which part of their guess was wrong.
    if (!verified) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const viewsToday = await db.adReward.count({
      where: { userId: verified.userId, placement: verified.placement, grantedAt: { gte: since } },
    });

    const decision = canGrantReward({
      placementId: verified.placement,
      viewsToday,
      adsEnabled: true,
    });

    if (!decision.allowed) {
      return NextResponse.json({ success: false, reason: decision.reason }, { status: 200 });
    }

    const season = await getActiveSeason();
    if (!season) return NextResponse.json({ success: false, reason: 'no-season' }, { status: 200 });

    const granted = await db.$transaction(async tx => {
      // The unique constraint on providerRef is what makes this replay-proof:
      // the same transaction id cannot pay out twice even if the network
      // retries the callback, which networks do.
      try {
        await tx.adReward.create({
          data: {
            userId: verified.userId,
            placement: verified.placement,
            providerRef: verified.providerRef,
          },
        });
      } catch {
        return null; // Already granted.
      }

      const pass = await tx.seasonPass.upsert({
        where: { userId_seasonId: { userId: verified.userId, seasonId: season.id } },
        create: { userId: verified.userId, seasonId: season.id },
        update: {},
      });

      const xpFromVideoToday = await tx.adReward.count({
        where: { userId: verified.userId, grantedAt: { gte: since } },
      });

      const { xp, granted: xpGranted } = applyDailyXp({
        currentXp: pass.xp,
        earnedToday: decision.passXp ?? 0,
        // Approximated from view count rather than tracked separately: the cap
        // only has to be a ceiling, and over-counting here errs towards
        // granting less, never more.
        alreadyEarnedToday: xpFromVideoToday * (decision.passXp ?? 0),
      });

      await tx.seasonPass.update({ where: { id: pass.id }, data: { xp } });
      return xpGranted;
    });

    if (granted === null) {
      return NextResponse.json({ success: false, reason: 'already-granted' });
    }

    return NextResponse.json({ success: true, passXpGranted: granted, dailyCap: PASS_CONFIG.dailyXpCap });
  } catch (error) {
    return handleApiError(error);
  }
}
