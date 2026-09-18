// ============================================
// Bangladesh Business Tycoon - Account ↔ Save linking
// ============================================
//
// A `User` is a login; a `Player` is the save game. This module is the single
// place where the two are tied together, so every sign-in path (password,
// Google, or a future provider) ends up with exactly one save per account.

import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { STARTING_CASH } from '@/lib/game-data';
import { ensureActiveSeason } from '@/lib/game/seasons/seasons';
import { SESSION_COOKIE, readSessionValue } from './session';

export interface AccountUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
}

/**
 * Pick the email to store on the save row.
 *
 * `Player.email` is unique and predates accounts, so a leftover row can already
 * hold the address (an old guest save, or a re-created account). The account
 * email is used when it is free, otherwise a stable per-user address.
 *
 * Seasons make the collision certain rather than incidental: the same account
 * gets a new save every season, so the fallback is keyed by season too.
 */
async function playerEmailFor(
  user: AccountUser,
  seasonNumber: number,
  claimedPlayerId?: string,
): Promise<string> {
  const holder = await db.player.findUnique({
    where: { email: user.email },
    select: { id: true },
  });
  if (!holder || holder.id === claimedPlayerId) return user.email;
  return `${user.id}.s${seasonNumber}@account.local`;
}

/**
 * Find the guest save from before the player had an account.
 *
 * The pre-accounts build kept progress under a signed `playerId` cookie. When
 * someone signs up from that browser we move that save onto the new account
 * instead of dropping them into an empty game.
 */
async function findClaimableGuestPlayer(): Promise<string | null> {
  const cookieStore = await cookies();
  const guestPlayerId = readSessionValue(cookieStore.get(SESSION_COOKIE)?.value);
  if (!guestPlayerId) return null;

  const guest = await db.player.findFirst({
    where: { id: guestPlayerId, userId: null, isAI: false },
    select: { id: true },
  });


  return guest?.id ?? null;
}

export interface EnsurePlayerResult {
  playerId: string;
  /** True when a guest save was adopted by this account. */
  claimedGuestSave: boolean;
}

/**
 * Guarantee that `user` has a save in the *active season*, and return it.
 *
 * Called on every sign-in, not just sign-up. It is also how a season reset is
 * actually delivered: an account whose last save belongs to a closed season has
 * no row for the new one, so it gets a fresh ৳500,000 here the first time it
 * comes back. Nothing carries over except the prestige and badges on the
 * account, which buy cosmetics and nothing else — every season starts level.
 */
export async function ensurePlayerForUser(user: AccountUser): Promise<EnsurePlayerResult> {
  const season = await ensureActiveSeason();

  const existing = await db.player.findUnique({
    where: { userId_seasonId: { userId: user.id, seasonId: season.id } },
    select: { id: true, avatar: true },
  });

  if (existing) {
    // Keep the Google profile picture fresh without overwriting a name the
    // player may have set inside the game.
    if (user.image && user.image !== existing.avatar) {
      await db.player.update({ where: { id: existing.id }, data: { avatar: user.image } });
    }
    return { playerId: existing.id, claimedGuestSave: false };
  }

  const guestPlayerId = await findClaimableGuestPlayer();

  if (guestPlayerId) {
    const claimed = await db.player.update({
      where: { id: guestPlayerId },
      data: {
        userId: user.id,
        seasonId: season.id,
        email: await playerEmailFor(user, season.number, guestPlayerId),
        avatar: user.image ?? undefined,
      },
      select: { id: true },
    });
    return { playerId: claimed.id, claimedGuestSave: true };
  }

  const created = await db.player.create({
    data: {
      userId: user.id,
      seasonId: season.id,
      name: user.name,
      email: await playerEmailFor(user, season.number),
      avatar: user.image ?? null,
      cash: STARTING_CASH,
      netWorth: STARTING_CASH,
    },
    select: { id: true },
  });

  return { playerId: created.id, claimedGuestSave: false };
}

/** Shape returned to the client for the signed-in account. */
export interface AccountProfile {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    hasPassword: boolean;
    providers: string[];
    createdAt: Date;
    /** Carries across seasons. Status only — never an economic advantage. */
    prestige: number;
    seasonsPlayed: number;
    bestRank: number | null;
  };
  player: {
    id: string;
    name: string;
    avatar: string | null;
    level: number;
    netWorth: number;
    createdAt: Date;
  } | null;
}

/** Load the account + save pair for a user id, for `/api/auth/me` and settings. */
export async function getAccountProfile(userId: string): Promise<AccountProfile | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      passwordHash: true,
      createdAt: true,
      prestige: true,
      seasonsPlayed: true,
      bestRank: true,
      accounts: { select: { provider: true } },
      players: {
        where: { season: { status: 'ACTIVE' } },
        select: { id: true, name: true, avatar: true, level: true, netWorth: true, createdAt: true },
        take: 1,
      },
    },
  });

  if (!user) return null;

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      hasPassword: Boolean(user.passwordHash),
      providers: user.accounts.map((a) => a.provider),
      createdAt: user.createdAt,
      prestige: user.prestige,
      seasonsPlayed: user.seasonsPlayed,
      bestRank: user.bestRank,
    },
    player: user.players[0] ?? null,
  };
}
