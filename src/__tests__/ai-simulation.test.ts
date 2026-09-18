// ============================================
// Bangladesh Business Tycoon - AI Simulation Guard
// ============================================
//
// `ai-simulation-test.ts` is a 1,000-line harness that runs eight AI
// competitors through a hundred game days. It computed a verdict the whole
// time — and printed it to a terminal nobody was watching. On the day this file
// was written it was reporting three bankrupt competitors and a net-worth
// spread past its own threshold, and had been for months.
//
// This is that verdict, wired to the build.
//
// ---- What is asserted, and why the split ----
//
// `BALANCE-RISKS.md` records that this simulation omits game events, market
// price variation, employee skill bonuses and human competition — every one of
// them a *positive* factor — so it reliably reports a harsher economy than the
// real engine produces. It says, in as many words, not to tune balance from it
// alone.
//
// Taking that seriously means splitting the assertions:
//
//   * Structure is asserted hard. Non-finite values, an AI that never acts, a
//     collapsed field: the omissions above cannot explain any of those away.
//
//   * Magnitudes are ratcheted, not fixed. The current bankruptcy count and
//     divergence are pinned at today's measured values, so they can improve and
//     cannot regress. Tightening them further is a balance change that has to
//     be validated against the real engine first.
//
// ---- Why the thresholds have headroom ----
//
// The harness is only partially deterministic: its seed governs the AI's
// choices, but the shared economy formulas use `Math.random()` for their
// volatility layers. Measured over 12 runs, the bankruptcy count was identical
// every time (3) while the coefficient of variation moved between 1.12 and
// 1.35. So bankruptcy is ratcheted at its stable value and divergence is given
// room above the observed maximum.

import { describe, it, expect } from 'vitest';
import { runSimulation, analyseBalance } from '@/lib/game/ai/ai-simulation-test';

/**
 * Today's measured behaviour, pinned.
 *
 * These are a ratchet, not a target. Lowering them is an improvement and
 * should come with the number here lowered to match; raising one means
 * something regressed.
 */
const BASELINE = {
  /** Identical in 12 of 12 runs: two AGGRESSIVE and one EXPANSIONIST. */
  maxBankruptcies: 3,
  /** Observed 1.12–1.35; the error bar in `analyseBalance` sits at 2.0. */
  maxCoefficientOfVariation: 1.45,
  /** Eight competitors are seeded. */
  competitors: 8,
} as const;

// One run, shared. A hundred simulated days across eight players is not free,
// and every assertion below reads a different facet of the same run.
const result = runSimulation();

describe('AI simulation', () => {
  describe('structure — asserted hard', () => {
    it('reports no errors', () => {
      const errors = result.issues.filter(i => i.severity === 'error');
      expect(
        errors.map(e => `[${e.code}] ${e.message}`),
        'the simulation found a structural problem',
      ).toEqual([]);
    });

    it('produces finite numbers for every competitor', () => {
      // A NaN propagating through net worth makes every other check below
      // meaningless while still looking like a number.
      const final = result.metrics[result.metrics.length - 1];
      for (const player of result.players) {
        expect(Number.isFinite(final.playerNetWorth[player.id]), player.name).toBe(true);
        expect(Number.isFinite(final.playerCash[player.id]), player.name).toBe(true);
      }
    });

    it('runs every competitor for the full hundred days', () => {
      expect(result.days).toBe(100);
      expect(result.metrics).toHaveLength(100);
      expect(result.players).toHaveLength(BASELINE.competitors);
    });

    it('leaves no competitor stuck holding', () => {
      // An AI that never acts leaves every other figure looking entirely
      // reasonable, which is what makes it worth asserting explicitly.
      expect(result.inertPlayers).toEqual([]);
    });

    it('exercises more than one kind of decision', () => {
      // An AI that only ever restocks is not a strategy layer. Observed 5-6
      // distinct action types.
      const kinds = Object.keys(result.actionsTaken);
      expect(kinds.length, `only took: ${kinds.join(', ')}`).toBeGreaterThanOrEqual(4);
      expect(result.actionsTaken.BUY_INVENTORY ?? 0).toBeGreaterThan(0);
      expect(result.actionsTaken.CHANGE_PRICE ?? 0).toBeGreaterThan(0);
    });

    it('does not let the whole field collapse', () => {
      const bankruptcies = result.issues.filter(i => i.code === 'BANKRUPT').length;
      expect(bankruptcies).toBeLessThanOrEqual(result.players.length / 2);
    });
  });

  describe('balance — ratcheted against today', () => {
    it(`has no more than ${BASELINE.maxBankruptcies} competitors go bankrupt`, () => {
      const bankrupt = result.issues.filter(i => i.code === 'BANKRUPT');
      // A ratchet, not a pin: fewer is an improvement and passes. If it does
      // improve, lower `BASELINE.maxBankruptcies` to match, or the guard
      // quietly loosens and stops catching the regression it exists for.
      expect(
        bankrupt.length,
        `competitors went under: ${bankrupt.map(i => i.message).join('; ')}`,
      ).toBeLessThanOrEqual(BASELINE.maxBankruptcies);
    });

    it('keeps net worth from spreading further than it does today', () => {
      expect(result.coefficientOfVariation).toBeLessThanOrEqual(
        BASELINE.maxCoefficientOfVariation,
      );
    });

    it('keeps at least half the field solvent', () => {
      const final = result.metrics[result.metrics.length - 1];
      const solvent = result.players.filter(p => final.playerNetWorth[p.id] > 0);
      expect(solvent.length).toBeGreaterThanOrEqual(result.players.length / 2);
    });

    it('gives every personality a run', () => {
      // Each of the five should be represented, or the comparison above is
      // measuring a subset and quietly calling it the field.
      const personalities = new Set(result.players.map(p => p.personality));
      expect(personalities.size).toBe(5);
    });
  });

  describe('analyseBalance', () => {
    it('is pure — the same state judged twice gives the same verdict', () => {
      const a = analyseBalance(result.players, result.metrics);
      const b = analyseBalance(result.players, result.metrics);
      expect(a.issues).toEqual(b.issues);
      expect(a.coefficientOfVariation).toBe(b.coefficientOfVariation);
    });

    it('reports a personality averaging a loss', () => {
      // The original check guarded on `minAvg > 0`, so the single worst case —
      // one personality losing money while another thrives — was the one thing
      // it could never report. This is that hole, held closed.
      const losing = Object.entries(result.personalityAvgNetWorth)
        .filter(([, avg]) => avg <= 0)
        .map(([name]) => name);

      if (losing.length > 0) {
        expect(
          result.issues.some(i => i.code === 'DOMINATION'),
          `${losing.join(', ')} averaged a loss but no domination issue was raised`,
        ).toBe(true);
      }
    });

    it('classifies every issue it raises', () => {
      for (const issue of result.issues) {
        expect(['error', 'warning']).toContain(issue.severity);
        expect(issue.message.length).toBeGreaterThan(10);
      }
    });
  });

  describe('a shorter run still holds together', () => {
    // Guards the driver itself against assuming a hundred days — the growth
    // checks index day 30, which a 20-day run does not have.
    it('survives being asked for twenty days', () => {
      const short = runSimulation({ days: 20 });
      expect(short.metrics).toHaveLength(20);
      expect(short.issues.filter(i => i.severity === 'error')).toEqual([]);
    });
  });
});
