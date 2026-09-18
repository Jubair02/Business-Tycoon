// ============================================
// Season pass
// POST /api/commerce/pass — claim a tier's reward
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { handleApiError, unauthorized, validationError, conflict, notFound } from '@/lib/errors';
import { resolveSession } from '@/lib/auth/user-session';
import { getActiveSeason } from '@/lib/game/seasons/seasons';
import { canClaimTier, claimKeyFor, passProgress } from '@/lib/commerce/season-pass';

const claimSchema = z.object({
  tier: z.number().int().min(1).max(100),
  track: z.enum(['free', 'premium']).default('free'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await resolveSession();
    if (!session?.userId) throw unauthorized();

    const season = await getActiveSeason();
    if (!season) throw notFound('Season');

    const { tier, track } = claimSchema.parse(await request.json());

    const result = await db.$transaction(async tx => {
      const pass = await tx.seasonPass.findUnique({
        where: { userId_seasonId: { userId: session.userId!, seasonId: season.id } },
      });
      if (!pass) throw notFound('Season pass');

      let claimedTiers: number[] = [];
      try {
        const parsed = JSON.parse(pass.claimedTiers);
        if (Array.isArray(parsed)) claimedTiers = parsed.filter((n): n is number => typeof n === 'number');
      } catch {
        // Treat an unreadable history as empty rather than refusing forever.
      }

      // Every condition is re-checked here, inside the transaction, against the
      // stored row. The client showing a claim button proves nothing, and two
      // simultaneous claims must not both succeed.
      const verdict = canClaimTier({
        tier,
        track,
        xp: pass.xp,
        premium: pass.premium,
        claimedTiers,
      });

      if (!verdict.allowed) {
        if (verdict.reason === 'already-claimed') throw conflict('Already claimed.');
        if (verdict.reason === 'needs-premium') throw validationError('That reward is on the premium track.');
        if (verdict.reason === 'not-reached') throw validationError('You have not reached that tier yet.');
        if (verdict.reason === 'no-reward') throw validationError('There is no reward on that track at that tier.');
        throw validationError('That tier cannot be claimed.');
      }

      const claimKey = claimKeyFor(tier, track);

      await tx.seasonPass.update({
        where: { id: pass.id },
        data: { claimedTiers: JSON.stringify([...claimedTiers, claimKey]) },
      });

      // A tier whose reward is a flourish rather than an owned item grants no
      // entitlement — it is recorded as claimed and nothing else.
      if (verdict.sku) {
        await tx.entitlement.upsert({
          where: { userId_sku: { userId: session.userId!, sku: verdict.sku } },
          create: {
            userId: session.userId!,
            sku: verdict.sku,
            source: 'PASS',
            seasonId: season.id,
          },
          update: {},
        });
      }

      return { sku: verdict.sku ?? null, xp: pass.xp };
    });

    return NextResponse.json({
      success: true,
      claimedTier: tier,
      track,
      granted: result.sku,
      progress: passProgress(result.xp),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
