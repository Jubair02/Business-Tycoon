// ============================================
// Server game clock — config and endpoint auth
// ============================================

import { describe, it, expect } from 'vitest';
import {
  resolveTickIntervalMs,
  isSchedulerEnabled,
  nextTickAt,
  DEFAULT_TICK_INTERVAL_MS,
  MIN_TICK_INTERVAL_MS,
  MAX_TICK_INTERVAL_MS,
} from '@/lib/game/tick-schedule';
import { authorizeTickRequest } from '@/lib/game/tick-auth';

describe('resolveTickIntervalMs', () => {
  it('uses the default when unset or blank', () => {
    expect(resolveTickIntervalMs(undefined)).toBe(DEFAULT_TICK_INTERVAL_MS);
    expect(resolveTickIntervalMs(null)).toBe(DEFAULT_TICK_INTERVAL_MS);
    expect(resolveTickIntervalMs('   ')).toBe(DEFAULT_TICK_INTERVAL_MS);
  });

  it('accepts a sensible value', () => {
    expect(resolveTickIntervalMs('30000')).toBe(30_000);
  });

  it('falls back rather than freezing the game on a bad value', () => {
    // A typo must not stop the world; a disabled clock is what the on/off
    // switch is for.
    expect(resolveTickIntervalMs('abc')).toBe(DEFAULT_TICK_INTERVAL_MS);
    expect(resolveTickIntervalMs('-1')).toBe(DEFAULT_TICK_INTERVAL_MS);
    expect(resolveTickIntervalMs('0')).toBe(DEFAULT_TICK_INTERVAL_MS);
  });

  it('clamps a value that would hammer the tick lock', () => {
    expect(resolveTickIntervalMs('200')).toBe(MIN_TICK_INTERVAL_MS);
  });

  it('clamps a value that looks like it was pasted in the wrong unit', () => {
    expect(resolveTickIntervalMs('999999999')).toBe(MAX_TICK_INTERVAL_MS);
  });
});

describe('isSchedulerEnabled', () => {
  it('defaults to on — the game is unplayable without a clock', () => {
    expect(isSchedulerEnabled(undefined)).toBe(true);
    expect(isSchedulerEnabled('')).toBe(true);
  });

  it('accepts the documented off switches', () => {
    for (const value of ['off', 'OFF', 'false', '0', ' off ']) {
      expect(isSchedulerEnabled(value)).toBe(false);
    }
  });

  it('treats anything else as on', () => {
    expect(isSchedulerEnabled('on')).toBe(true);
    expect(isSchedulerEnabled('yes')).toBe(true);
  });
});

describe('nextTickAt', () => {
  it('adds the interval to the last tick', () => {
    expect(nextTickAt('2026-09-18T10:00:00.000Z', 60_000)).toBe('2026-09-18T10:01:00.000Z');
  });

  it('returns null when the world has never ticked', () => {
    expect(nextTickAt(null, 60_000)).toBeNull();
  });

  it('returns null for an unparseable timestamp rather than inventing one', () => {
    expect(nextTickAt('never', 60_000)).toBeNull();
  });
});

describe('authorizeTickRequest', () => {
  const headers = (init: Record<string, string> = {}) => new Headers(init);

  it('accepts a matching bearer token', () => {
    const result = authorizeTickRequest(headers({ authorization: 'Bearer s3cret' }), {
      CRON_SECRET: 's3cret',
      NODE_ENV: 'production',
    });
    expect(result).toEqual({ authorized: true, via: 'secret' });
  });

  it('accepts the x-cron-secret header for runners that cannot set Authorization', () => {
    expect(
      authorizeTickRequest(headers({ 'x-cron-secret': 's3cret' }), {
        CRON_SECRET: 's3cret',
        NODE_ENV: 'production',
      }).authorized,
    ).toBe(true);
  });

  it('is case-insensitive about the Bearer scheme', () => {
    expect(
      authorizeTickRequest(headers({ authorization: 'bearer s3cret' }), {
        CRON_SECRET: 's3cret',
        NODE_ENV: 'production',
      }).authorized,
    ).toBe(true);
  });

  it('rejects a wrong secret', () => {
    expect(
      authorizeTickRequest(headers({ authorization: 'Bearer wrong' }), {
        CRON_SECRET: 's3cret',
        NODE_ENV: 'production',
      }).authorized,
    ).toBe(false);
  });

  it('rejects a secret of a different length without leaking that fact', () => {
    // Different lengths must still take the hash-then-compare path rather than
    // throwing out of timingSafeEqual.
    expect(() =>
      authorizeTickRequest(headers({ authorization: 'Bearer short' }), {
        CRON_SECRET: 'a-considerably-longer-secret',
        NODE_ENV: 'production',
      }),
    ).not.toThrow();
  });

  it('rejects a missing credential', () => {
    const result = authorizeTickRequest(headers(), {
      CRON_SECRET: 's3cret',
      NODE_ENV: 'production',
    });
    expect(result.authorized).toBe(false);
  });

  it('rejects an empty bearer token', () => {
    expect(
      authorizeTickRequest(headers({ authorization: 'Bearer    ' }), {
        CRON_SECRET: 's3cret',
        NODE_ENV: 'production',
      }).authorized,
    ).toBe(false);
  });

  it('closes the endpoint in production when no secret is configured', () => {
    const result = authorizeTickRequest(headers(), { NODE_ENV: 'production' });
    expect(result.authorized).toBe(false);
    if (!result.authorized) expect(result.reason).toContain('CRON_SECRET');
  });

  it('stays open in development so local play needs no ceremony', () => {
    expect(authorizeTickRequest(headers(), { NODE_ENV: 'development' })).toEqual({
      authorized: true,
      via: 'development',
    });
  });

  it('treats a blank secret as unconfigured', () => {
    expect(
      authorizeTickRequest(headers({ authorization: 'Bearer  ' }), {
        CRON_SECRET: '   ',
        NODE_ENV: 'production',
      }).authorized,
    ).toBe(false);
  });
});

describe('a player can no longer advance the world', () => {
  it('a session cookie alone does not authorize a tick in production', () => {
    // The old route required only requirePlayerId(); the cookie is now
    // irrelevant to this endpoint.
    const result = authorizeTickRequest(
      new Headers({ cookie: 'bt_session=whatever' }),
      { CRON_SECRET: 's3cret', NODE_ENV: 'production' },
    );
    expect(result.authorized).toBe(false);
  });
});
