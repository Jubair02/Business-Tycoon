// ============================================
// Bangladesh Business Tycoon - World clock speed
// ============================================
//
// The dial is a world setting, and the two clocks that read it — the in-process
// scheduler and a hosted cron — must agree on when a day is due. These tests
// pin that agreement, and the one thing the dial must never do: run one
// player's world faster than another's.

import { describe, it, expect } from 'vitest';
import {
  CLOCK_SPEEDS,
  DEFAULT_CLOCK_SPEED,
  isClockSpeed,
  parseClockSpeed,
  effectiveIntervalMs,
  isTickDue,
  nextTickAtSpeed,
  clockIsRunning,
  fastestIntervalMs,
} from '@/lib/game/clock-speed';
import { DEFAULT_TICK_INTERVAL_MS } from '@/lib/game/tick-schedule';

const BASE = DEFAULT_TICK_INTERVAL_MS;
const at = (iso: string) => new Date(iso);

/**
 * Offsets are written as fractions of the base interval, never as wall-clock
 * hours.
 *
 * They used to be hardcoded — "04:00Z is one day after 00:00Z" — which was only
 * true while a game day happened to be four real hours. Changing the clock then
 * broke a dozen assertions that were describing entirely correct behaviour.
 */
const since = (last: string, ms: number) => new Date(new Date(last).getTime() + ms);
const before = (from: Date, ms: number) => new Date(from.getTime() - ms).toISOString();

describe('the dial', () => {
  it('offers exactly 1x, 2x, 4x and 8x', () => {
    expect([...CLOCK_SPEEDS]).toEqual([1, 2, 4, 8]);
    expect(DEFAULT_CLOCK_SPEED).toBe(1);
  });

  it('narrows an untrusted value to a real speed, or to 1x', () => {
    // A corrupt row in GameState must leave the world running normally, not
    // frozen and not at some arbitrary pace.
    expect(parseClockSpeed('4')).toBe(4);
    expect(parseClockSpeed(8)).toBe(8);
    expect(parseClockSpeed('3')).toBe(1);
    expect(parseClockSpeed('16')).toBe(1);
    expect(parseClockSpeed('fast')).toBe(1);
    expect(parseClockSpeed(null)).toBe(1);
    expect(parseClockSpeed(undefined)).toBe(1);
    expect(isClockSpeed(0)).toBe(false);
    expect(isClockSpeed(-2)).toBe(false);
  });

  it('divides the day by the speed', () => {
    expect(effectiveIntervalMs(BASE, 1)).toBe(BASE);
    expect(effectiveIntervalMs(BASE, 2)).toBe(BASE / 2);
    expect(effectiveIntervalMs(BASE, 8)).toBe(BASE / 8);
  });

  it('never produces a zero-length day', () => {
    expect(effectiveIntervalMs(1, 8)).toBeGreaterThanOrEqual(1);
  });
});

describe('when a day is due', () => {
  const last = '2026-09-28T00:00:00.000Z';

  it('is always due for a world that has never ticked', () => {
    // A fresh deployment must not wait a whole interval for its first day.
    expect(isTickDue({ lastTickISO: null, now: at(last), baseIntervalMs: BASE, speed: 1 })).toBe(true);
  });

  it('waits a full base interval at 1x', () => {
    expect(isTickDue({ lastTickISO: last, now: since(last, BASE / 2), baseIntervalMs: BASE, speed: 1 })).toBe(false);
    expect(isTickDue({ lastTickISO: last, now: since(last, BASE), baseIntervalMs: BASE, speed: 1 })).toBe(true);
  });

  it('is due four times as often at 4x', () => {
    expect(isTickDue({ lastTickISO: last, now: since(last, BASE / 8), baseIntervalMs: BASE, speed: 4 })).toBe(false);
    expect(isTickDue({ lastTickISO: last, now: since(last, BASE / 4), baseIntervalMs: BASE, speed: 4 })).toBe(true);
  });

  it('forgives a cron that fires a fraction early', () => {
    // A scheduled firing lands a little either side of the mark. Skipping one
    // that is barely early would cost the world a whole interval.
    expect(isTickDue({ lastTickISO: last, now: since(last, BASE * 0.99), baseIntervalMs: BASE, speed: 1 })).toBe(true);
  });

  it('does not forgive a firing that is genuinely early', () => {
    expect(isTickDue({ lastTickISO: last, now: since(last, BASE * 0.875), baseIntervalMs: BASE, speed: 1 })).toBe(false);
  });

  it('treats an unreadable last tick as due', () => {
    expect(isTickDue({ lastTickISO: 'not a date', now: at(last), baseIntervalMs: BASE, speed: 1 })).toBe(true);
  });

  it('gives a cron at the fastest cadence a correct answer at every speed', () => {
    // The whole reason one cron schedule serves every position of the dial: at
    // 1x, seven of eight firings say "not yet", and the eighth ticks.
    const cadence = fastestIntervalMs(BASE);
    expect(cadence).toBe(BASE / 8);

    for (const speed of CLOCK_SPEEDS) {
      let ticks = 0;
      let lastTick = last;
      for (let firing = 1; firing <= 8; firing++) {
        const now = new Date(new Date(last).getTime() + firing * cadence);
        if (isTickDue({ lastTickISO: lastTick, now, baseIntervalMs: BASE, speed })) {
          ticks++;
          lastTick = now.toISOString();
        }
      }
      // Over one base interval, the world should tick `speed` times.
      expect(ticks, `${speed}x over one base interval`).toBe(speed);
    }
  });
});

describe('the countdown', () => {
  it('points at the next day, at the current speed', () => {
    const last = '2026-09-28T00:00:00.000Z';
    expect(nextTickAtSpeed({ lastTickISO: last, baseIntervalMs: BASE, speed: 1 }))
      .toBe(since(last, BASE).toISOString());
    expect(nextTickAtSpeed({ lastTickISO: last, baseIntervalMs: BASE, speed: 8 }))
      .toBe(since(last, BASE / 8).toISOString());
  });

  it('is null only for a world that has never ticked', () => {
    expect(nextTickAtSpeed({ lastTickISO: null, baseIntervalMs: BASE, speed: 1 })).toBeNull();
    expect(nextTickAtSpeed({ lastTickISO: 'garbage', baseIntervalMs: BASE, speed: 1 })).toBeNull();
  });
});

describe('whether the world is running', () => {
  const now = at('2026-09-28T12:00:00Z');

  it('is running when this process holds the clock', () => {
    expect(clockIsRunning({ schedulerEnabledHere: true, lastTickISO: null, now, baseIntervalMs: BASE, speed: 1 })).toBe(true);
  });

  it('is running when a cron has ticked it recently', () => {
    // The Vercel case: no scheduler here, but the world is advancing. Telling
    // players "clock paused" while it did so was a real bug.
    const recent = before(now, BASE / 4);
    expect(clockIsRunning({ schedulerEnabledHere: false, lastTickISO: recent, now, baseIntervalMs: BASE, speed: 1 })).toBe(true);
  });

  it('has stalled once two intervals pass with no tick', () => {
    // The cron stopped reaching the endpoint. Counting down to a day that is
    // not coming would be worse than saying so.
    const stale = before(now, BASE * 2.25);
    expect(clockIsRunning({ schedulerEnabledHere: false, lastTickISO: stale, now, baseIntervalMs: BASE, speed: 1 })).toBe(false);
  });

  it('judges staleness at the current speed', () => {
    // A gap of a quarter of the base interval is two whole days at 8x — a
    // stall — and a fraction of one at 1x.
    const gap = before(now, BASE / 4 + 1);
    expect(clockIsRunning({ schedulerEnabledHere: false, lastTickISO: gap, now, baseIntervalMs: BASE, speed: 8 })).toBe(false);
    expect(clockIsRunning({ schedulerEnabledHere: false, lastTickISO: gap, now, baseIntervalMs: BASE, speed: 1 })).toBe(true);
  });

  it('is not running for a world that has never ticked and has no scheduler', () => {
    expect(clockIsRunning({ schedulerEnabledHere: false, lastTickISO: null, now, baseIntervalMs: BASE, speed: 1 })).toBe(false);
  });
});
