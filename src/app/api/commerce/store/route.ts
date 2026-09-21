// ============================================
// Store
// GET  /api/commerce/store    — catalogue, what you own, pass progress
// POST /api/commerce/store    — start a purchase
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { handleApiError, unauthorized, validationError, conflict } from '@/lib/errors';
import { resolveSession } from '@/lib/auth/user-session';
import { getActiveSeason } from '@/lib/game/seasons/seasons';
import { CATALOGUE, getCatalogueItem, canPurchase } from '@/lib/commerce/catalogue';
import { buildPassTrack, passProgress, PASS_CONFIG } from '@/lib/commerce/season-pass';
import { REWARD_PLACEMENTS } from '@/lib/commerce/rewards';
import { getPaymentProvider, adsEnabled, newIdempotencyKey } from '@/lib/commerce/providers';
import { trackServer } from '@/lib/analytics/identity';
import { EVENTS } from '@/lib/analytics/events';

export async function GET() {
  try {
    void trackServer(EVENTS.STORE_VIEWED);

    const session = await resolveSession();
    const season = await getActiveSeason();

    const base = {
      catalogue: CATALOGUE,
      passTrack: buildPassTrack(),
      passConfig: PASS_CONFIG,
      rewardPlacements: adsEnabled() ? REWARD_PLACEMENTS : [],
      adsEnabled: adsEnabled(),
      provider: getPaymentProvider().id,
      season: season ? { id: season.id, number: season.number, name: season.name } : null,
    };

    if (!session?.userId) {
      return NextResponse.json({ ...base, owned: [], pass: null, prestige: 0 });
    }

    const [entitlements, user, pass] = await Promise.all([
      db.entitlement.findMany({ where: { userId: session.userId }, select: { sku: true, source: true } }),
      db.user.findUnique({ where: { id: session.userId }, select: { prestige: true } }),
      season
        ? db.seasonPass.findUnique({
            where: { userId_seasonId: { userId: session.userId, seasonId: season.id } },
          })
        : Promise.resolve(null),
    ]);

    let claimedTiers: number[] = [];
    if (pass) {
      try {
        const parsed = JSON.parse(pass.claimedTiers);
        if (Array.isArray(parsed)) claimedTiers = parsed.filter((n): n is number => typeof n === 'number');
      } catch {
        // A malformed row costs the claim history, not the response.
      }
    }

    return NextResponse.json({
      ...base,
      owned: entitlements,
      prestige: user?.prestige ?? 0,
      pass: pass
        ? { premium: pass.premium, claimedTiers, ...passProgress(pass.xp) }
        : { premium: false, claimedTiers: [], ...passProgress(0) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const purchaseSchema = z.object({
  sku: z.string().min(1).max(64),
  /** Supplied by the client so a retried request cannot charge twice. */
  idempotencyKey: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await resolveSession();
    if (!session?.userId) throw unauthorized();

    const { sku, idempotencyKey } = purchaseSchema.parse(await request.json());

    const item = getCatalogueItem(sku);
    if (!item) throw validationError(`Unknown item: ${sku}`);

    const [owned, user] = await Promise.all([
      db.entitlement.findMany({ where: { userId: session.userId }, select: { sku: true } }),
      db.user.findUnique({ where: { id: session.userId }, select: { prestige: true } }),
    ]);

    const verdict = canPurchase({
      sku,
      ownedSkus: owned.map(o => o.sku),
      prestige: user?.prestige ?? 0,
    });

    if (!verdict.allowed) {
      if (verdict.reason === 'owned') throw conflict('You already own this.');
      if (verdict.reason === 'prestige') {
        throw validationError(`This unlocks at prestige ${item.requiresPrestige}.`);
      }
      if (verdict.reason === 'not-for-sale') throw validationError('This item is earned, not sold.');
      throw validationError('That item cannot be bought.');
    }

    const key = idempotencyKey ?? newIdempotencyKey();

    // An existing order under the same key is returned rather than duplicated:
    // a double-tapped buy button must not become two charges.
    const existing = await db.purchase.findUnique({ where: { idempotencyKey: key } });
    if (existing) {
      return NextResponse.json({
        success: true,
        purchaseId: existing.id,
        status: existing.status,
        redirectUrl: null,
        replayed: true,
      });
    }

    const provider = getPaymentProvider();

    const purchase = await db.purchase.create({
      data: {
        userId: session.userId,
        sku,
        priceMinor: item.priceMinor,
        currency: item.currency,
        provider: provider.id,
        status: 'PENDING',
        idempotencyKey: key,
      },
    });

    void trackServer(EVENTS.PURCHASE_STARTED, { sku, kind: item.kind, priceMinor: item.priceMinor });

    const origin = new URL(request.url).origin;
    const checkout = await provider.createCheckout({
      purchaseId: purchase.id,
      sku,
      priceMinor: item.priceMinor,
      currency: item.currency,
      userId: session.userId,
      returnUrl: `${origin}/settings`,
    });

    if (checkout.settledImmediately) {
      // The sandbox path: mark it paid and grant the entitlement in one
      // transaction, so a crash between the two cannot take the money and
      // withhold the item.
      await db.$transaction(async tx => {
        await tx.purchase.update({
          where: { id: purchase.id },
          data: { status: 'PAID', providerRef: checkout.providerRef },
        });

        if (item.kind === 'PASS') {
          const season = await getActiveSeason();
          if (season) {
            await tx.seasonPass.upsert({
              where: { userId_seasonId: { userId: session.userId!, seasonId: season.id } },
              create: { userId: session.userId!, seasonId: season.id, premium: true },
              update: { premium: true },
            });
          }
        } else {
          await tx.entitlement.upsert({
            where: { userId_sku: { userId: session.userId!, sku } },
            create: { userId: session.userId!, sku, source: 'PURCHASE' },
            update: {},
          });
        }
      });

      void trackServer(EVENTS.PURCHASE_COMPLETED, { sku, kind: item.kind, priceMinor: item.priceMinor });

      return NextResponse.json({
        success: true,
        purchaseId: purchase.id,
        status: 'PAID',
        redirectUrl: null,
      });
    }

    return NextResponse.json({
      success: true,
      purchaseId: purchase.id,
      status: 'PENDING',
      redirectUrl: checkout.redirectUrl,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
