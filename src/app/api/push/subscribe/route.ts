// ============================================
// Push subscriptions
// GET    /api/push/subscribe — whether push is available, and the public key
// POST   /api/push/subscribe — register this device
// DELETE /api/push/subscribe — unregister it
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { handleApiError, unauthorized } from '@/lib/errors';
import { resolveSession } from '@/lib/auth/user-session';
import { pushConfigured, NOTIFICATION_COOLDOWN_MS } from '@/lib/push/notifications';
import { parseLocale } from '@/lib/i18n/config';

/** The shape the browser's `PushSubscription.toJSON()` produces. */
const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
  locale: z.string().max(16).optional(),
  mutedKinds: z.array(z.string().max(32)).max(20).optional(),
});

export async function GET() {
  const session = await resolveSession();

  return NextResponse.json({
    supported: pushConfigured(),
    // Safe to publish — the VAPID public key is meant to be handed to browsers.
    publicKey: pushConfigured() ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null : null,
    kinds: Object.keys(NOTIFICATION_COOLDOWN_MS),
    subscribed: session?.userId
      ? (await db.pushSubscription.count({ where: { userId: session.userId } })) > 0
      : false,
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await resolveSession();
    if (!session?.userId) throw unauthorized();

    if (!pushConfigured()) {
      return NextResponse.json(
        { success: false, reason: 'Push is not configured on this server.' },
        { status: 503 },
      );
    }

    const body = subscribeSchema.parse(await request.json());

    // Keyed on the endpoint: re-subscribing the same device updates the row it
    // already has rather than accumulating duplicates every time the browser
    // rotates its keys.
    const saved = await db.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: {
        userId: session.userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        locale: parseLocale(body.locale),
        userAgent: request.headers.get('user-agent')?.slice(0, 255) ?? null,
        mutedKinds: JSON.stringify(body.mutedKinds ?? []),
      },
      update: {
        // An endpoint can be re-registered by a different account on a shared
        // device; the row follows whoever registered it last.
        userId: session.userId,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        locale: parseLocale(body.locale),
        lastUsedAt: new Date(),
        ...(body.mutedKinds ? { mutedKinds: JSON.stringify(body.mutedKinds) } : {}),
      },
      select: { id: true },
    });

    return NextResponse.json({ success: true, id: saved.id });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await resolveSession();
    if (!session?.userId) throw unauthorized();

    const { endpoint } = z
      .object({ endpoint: z.string().url().max(2048) })
      .parse(await request.json());

    // Scoped to the account so one player cannot unsubscribe another's device
    // by guessing an endpoint.
    await db.pushSubscription.deleteMany({
      where: { endpoint, userId: session.userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
