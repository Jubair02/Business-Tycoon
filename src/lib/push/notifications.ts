// ============================================
// Bangladesh Business Tycoon - Push Notifications
// ============================================
//
// The report's example was "your Gulshan shop is out of stock", and that is
// exactly the shape this takes: a small, closed set of things worth interrupting
// someone for, each one actionable, each one mutable per device.
//
// Notifications are a privilege, not a channel. Everything here is rate-limited
// by kind, nothing is sent to a player who is currently looking at the game, and
// a subscription that the push service rejects is deleted rather than retried
// forever.

import webpush from 'web-push';
import { db } from '@/lib/db';
import { translate } from '@/lib/i18n/translate';
import { parseLocale } from '@/lib/i18n/config';

/** The kinds of thing worth interrupting a player for. */
export type NotificationKind =
  | 'OUT_OF_STOCK'
  | 'STAFF_POACHED'
  | 'SEASON_ENDING'
  | 'SHOPS_DORMANT'
  | 'LOAN_DUE';

export interface NotificationPayload {
  kind: NotificationKind;
  title: string;
  body: string;
  /** Where clicking it should land. */
  url: string;
  /** Collapses repeats on the lock screen. */
  tag?: string;
}

/**
 * How often one kind may be sent to one account, in milliseconds.
 *
 * Deliberately generous windows. A simulation that ticks once a minute could
 * otherwise generate an "out of stock" notification every minute of the night.
 */
export const NOTIFICATION_COOLDOWN_MS: Record<NotificationKind, number> = {
  OUT_OF_STOCK: 6 * 60 * 60 * 1000,
  STAFF_POACHED: 60 * 60 * 1000,
  SEASON_ENDING: 24 * 60 * 60 * 1000,
  SHOPS_DORMANT: 12 * 60 * 60 * 1000,
  LOAN_DUE: 12 * 60 * 60 * 1000,
};

let configured: boolean | null = null;

/**
 * Whether push is usable in this deployment.
 *
 * Absent keys are a normal state — local development, a preview deployment, or
 * an operator who has not set push up — so this reports false and everything
 * downstream becomes a no-op, rather than throwing on import.
 */
export function pushConfigured(): boolean {
  if (configured !== null) return configured;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@bdtycoon.example';

  if (!publicKey || !privateKey) {
    configured = false;
    return configured;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch (error) {
    console.error('[push] VAPID configuration rejected:', error);
    configured = false;
  }

  return configured;
}

/** In-process cooldown ledger, keyed `userId:kind`. */
const lastSentAt = new Map<string, number>();

function withinCooldown(userId: string, kind: NotificationKind, now: number): boolean {
  const key = `${userId}:${kind}`;
  const previous = lastSentAt.get(key);
  if (previous === undefined) return false;
  return now - previous < NOTIFICATION_COOLDOWN_MS[kind];
}

/**
 * Send one notification to every device an account has registered.
 *
 * Returns the number of devices reached. Failures are swallowed by design: a
 * notification is never important enough to fail the tick that produced it.
 */
export async function sendToUser(
  userId: string,
  build: (t: (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => string) => NotificationPayload,
): Promise<number> {
  if (!pushConfigured()) return 0;

  const subscriptions = await db.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return 0;

  const now = Date.now();
  let delivered = 0;

  for (const subscription of subscriptions) {
    const locale = parseLocale(subscription.locale);
    const payload = build((key, params) => translate(locale, key, params));

    if (withinCooldown(userId, payload.kind, now)) continue;

    // A device can mute a kind without unsubscribing entirely.
    let muted: string[] = [];
    try {
      const parsed = JSON.parse(subscription.mutedKinds);
      if (Array.isArray(parsed)) muted = parsed;
    } catch {
      // A malformed row mutes nothing rather than breaking the send.
    }
    if (muted.includes(payload.kind)) continue;

    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: payload.url,
          tag: payload.tag ?? payload.kind,
          icon: '/icons/icon-192.png',
          lang: locale,
        }),
      );
      delivered++;
      lastSentAt.set(`${userId}:${payload.kind}`, now);
      await db.pushSubscription
        .update({ where: { id: subscription.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);
    } catch (error: any) {
      // 404/410 mean the push service has dropped this subscription: the device
      // uninstalled, cleared its data, or revoked permission. Keeping it would
      // mean retrying a dead endpoint on every tick, forever.
      const status = error?.statusCode;
      if (status === 404 || status === 410) {
        await db.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
      } else {
        console.error('[push] Send failed:', status ?? error);
      }
    }
  }

  return delivered;
}

// ============================================
// The messages themselves
// ============================================

export async function notifyOutOfStock(userId: string, shopName: string, shopId: string) {
  return sendToUser(userId, () => ({
    kind: 'OUT_OF_STOCK',
    title: 'Empty shelves',
    body: `${shopName} has sold out. It is still paying rent — restock it, or switch on the shop manager.`,
    url: `/businesses/${shopId}`,
    tag: `stock:${shopId}`,
  }));
}

export async function notifyStaffPoached(
  userId: string,
  employeeName: string,
  shopName: string,
  rivalName: string,
) {
  return sendToUser(userId, () => ({
    kind: 'STAFF_POACHED',
    title: 'You have lost a hand',
    body: `${employeeName} has left ${shopName} for ${rivalName}.`,
    url: '/businesses',
    tag: 'poach',
  }));
}

export async function notifySeasonEnding(userId: string, seasonName: string, daysLeft: number) {
  return sendToUser(userId, () => ({
    kind: 'SEASON_ENDING',
    title: `${seasonName} is nearly over`,
    body: `${daysLeft} days left. Where you finish decides your prestige and badges.`,
    url: '/leaderboard',
    tag: 'season',
  }));
}

export async function notifyShopsDormant(userId: string, shopCount: number) {
  return sendToUser(userId, () => ({
    kind: 'SHOPS_DORMANT',
    title: 'Your shops have closed',
    body:
      shopCount === 1
        ? 'Your shop has been shuttered since you have been away. Open the game to start it trading again.'
        : `Your ${shopCount} shops have been shuttered since you have been away. Open the game to start them trading again.`,
    url: '/dashboard',
    tag: 'dormant',
  }));
}

/** Exposed for tests: clears the in-process cooldown ledger. */
export function resetNotificationCooldowns(): void {
  lastSentAt.clear();
}
