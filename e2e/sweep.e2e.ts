// ============================================
// Bangladesh Business Tycoon - Whole-surface sweep
// ============================================
//
// The journey test proves one path works. This proves the rest of the product
// answers at all: every API handler and every screen, driven in a realistic
// order against a real database, with the ids each step produces fed into the
// next.
//
// It is deliberately shallow. It does not check that hiring a cashier produces
// the right salary — `journey.e2e.ts` and the unit suites do that kind of work.
// It checks that no handler 500s, no screen fails to render, and no route has
// quietly rotted while nothing pointed at it. That is the failure this catches:
// fifty-three route files and a journey that touched fifteen of them.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startHarness, type Harness } from './harness';

let app: Harness;

/** Ids discovered as the sweep goes, for the routes that need them. */
const found = {
  businessId: '',
  inventoryId: '',
  employeeId: '',
  campaignId: '',
  loanId: '',
  cohortId: '',
  joinCode: '',
};

/** Everything the sweep touched, so a failure names the whole picture. */
const results: { route: string; status: number; ok: boolean; note?: string }[] = [];

/**
 * Call a route and record the outcome.
 *
 * `accept` lists the statuses that are a correct answer for this route — a 402
 * from a shop you cannot afford is the endpoint working, not failing. Anything
 * outside the list is a finding.
 */
async function hit(
  label: string,
  path: string,
  init?: Parameters<Harness['api']>[1],
  accept: number[] = [200, 201],
): Promise<any> {
  const res = await app.api(path, init);
  const ok = accept.includes(res.status);
  results.push({
    route: label,
    status: res.status,
    ok,
    note: ok ? undefined : typeof res.body === 'string' ? res.body.slice(0, 200) : JSON.stringify(res.body).slice(0, 200),
  });
  return res;
}

function failures() {
  return results.filter(r => !r.ok);
}

/** Where the results list stands now, so a step can assert only its own work. */
function mark(): number {
  return results.length;
}

/**
 * Findings since `from`.
 *
 * Scoped per step on purpose: asserting the cumulative list made one early
 * finding fail every later step too, which buries the thing that actually
 * broke under five identical failures.
 */
function since(from: number) {
  return results.slice(from).filter(r => !r.ok);
}

beforeAll(async () => {
  app = await startHarness();
}, 300_000);

afterAll(async () => {
  // Printed whatever happens: a sweep whose output only appears on failure is
  // a sweep nobody reads.
  const bad = failures();
  console.log(`\n[sweep] ${results.length - bad.length}/${results.length} surfaces answered.`);
  for (const failure of bad) {
    console.log(`  FAIL ${failure.status} ${failure.route} :: ${failure.note}`);
  }
  await app?.stop();
});

describe('the whole surface', () => {
  it('seeds and signs in', async () => {
    await hit('POST /api/game/init', '/api/game/init', { method: 'POST' });

    const register = await hit(
      'POST /api/auth/register',
      '/api/auth/register',
      {
        method: 'POST',
        body: {
          name: 'Sweep Player',
          email: `sweep-${Date.now()}@example.test`,
          password: 'correct-horse-battery-staple',
        },
      },
      [201],
    );
    expect(register.status).toBe(201);
  }, 120_000);

  it('opens a shop and finds its parts', async () => {
    const created = await hit(
      'POST /api/businesses',
      '/api/businesses',
      {
        method: 'POST',
        // `location` is optional; an empty string is not a valid location id.
        body: { type: 'TEA_STALL', city: 'DHAKA', name: 'Sweep Tea' },
      },
      [201],
    );
    found.businessId = created.body?.id ?? '';
    expect(found.businessId).toBeTruthy();

    const detail = await hit(`GET /api/businesses/:id`, `/api/businesses/${found.businessId}`);
    found.inventoryId = detail.body?.inventories?.[0]?.id ?? '';
    expect(found.inventoryId).toBeTruthy();
  }, 120_000);

  it('answers every read-only endpoint', async () => {
    const from = mark();
    const id = found.businessId;

    await hit('GET /api/player', '/api/player');
    await hit('GET /api/player/logs', '/api/player/logs');
    await hit('GET /api/auth/me', '/api/auth/me');
    await hit('GET /api/game/state', '/api/game/state');
    await hit('GET /api/businesses', '/api/businesses');
    await hit('GET /api/portfolio', '/api/portfolio');
    await hit('GET /api/achievements', '/api/achievements');
    await hit('GET /api/leaderboard', '/api/leaderboard');
    await hit('GET /api/news', '/api/news');
    await hit('GET /api/events', '/api/events');
    await hit('GET /api/seasons', '/api/seasons');
    await hit('GET /api/calendar', '/api/calendar');
    // The market is city-scoped, and every caller in the UI passes one.
    await hit('GET /api/market', '/api/market?city=DHAKA');
    await hit('GET /api/market/products', '/api/market/products?type=TEA_STALL&city=DHAKA');
    await hit('GET /api/market/competition', '/api/market/competition?city=DHAKA&type=TEA_STALL');
    await hit('GET /api/expansion/eligibility', '/api/expansion/eligibility');
    await hit('GET /api/commerce/store', '/api/commerce/store');
    await hit('GET /api/education/cohorts', '/api/education/cohorts');
    await hit('GET /api/push/subscribe', '/api/push/subscribe');

    await hit('GET /api/businesses/:id/analytics', `/api/businesses/${id}/analytics`);
    await hit('GET /api/businesses/:id/logs', `/api/businesses/${id}/logs`);
    await hit('GET /api/businesses/:id/cx', `/api/businesses/${id}/cx`);
    await hit('GET /api/businesses/:id/pricing-advice', `/api/businesses/${id}/pricing-advice`);
    await hit('GET /api/businesses/:id/campaigns', `/api/businesses/${id}/campaigns`);
    await hit('GET /api/businesses/:id/campaigns/analytics', `/api/businesses/${id}/campaigns/analytics`);

    expect(since(from), JSON.stringify(since(from), null, 2)).toEqual([]);
  }, 180_000);

  it('runs the shop: stock, price, staff, restock, upgrade', async () => {
    const from = mark();
    const id = found.businessId;

    const market = await hit('GET /api/market/products (buy prep)', `/api/market/products?type=TEA_STALL&city=DHAKA`);
    const product = (market.body?.products ?? market.body)?.[0];

    if (product) {
      await hit(
        'POST /api/businesses/:id/inventory/buy',
        `/api/businesses/${id}/inventory/buy`,
        {
          method: 'POST',
          body: {
            productId: product.id ?? product.productId ?? 'p',
            productName: product.name ?? product.productName,
            category: product.category ?? 'FOOD',
            quantity: 10,
          },
        },
        [201],
      );
    }

    await hit(
      'PATCH /api/businesses/:id/inventory/:invId/price',
      `/api/businesses/${id}/inventory/${found.inventoryId}/price`,
      { method: 'PATCH', body: { sellPrice: 12 } },
    );

    await hit(
      'POST /api/businesses/:id/inventory/restock',
      `/api/businesses/${id}/inventory/restock`,
      { method: 'POST', body: { target: 0.9 } },
    );

    await hit(
      'PUT /api/businesses/:id/inventory/restock',
      `/api/businesses/${id}/inventory/restock`,
      {
        method: 'PUT',
        body: {
          autoRestock: true,
          autoRestockThreshold: 0.4,
          autoRestockTarget: 0.9,
          autoRestockBudget: null,
        },
      },
    );

    const hired = await hit(
      'POST /api/businesses/:id/employees/hire',
      `/api/businesses/${id}/employees/hire`,
      { method: 'POST', body: { role: 'CASHIER' } },
      [201],
    );
    found.employeeId = hired.body?.id ?? '';

    await hit(
      'POST /api/businesses/:id/inventory/sell',
      `/api/businesses/${id}/inventory/sell`,
      { method: 'POST', body: { inventoryId: found.inventoryId, quantity: 1 } },
      // Selling stock back may legitimately be refused; a 4xx is an answer.
      [200, 201, 400, 409],
    );

    await hit(
      'POST /api/businesses/:id/upgrade',
      `/api/businesses/${id}/upgrade`,
      { method: 'POST' },
      // Not enough cash for an upgrade is the endpoint working.
      [200, 201, 400, 402, 409],
    );

    expect(since(from), JSON.stringify(since(from), null, 2)).toEqual([]);
  }, 180_000);

  it('runs marketing, banking and the season pass', async () => {
    const from = mark();
    const id = found.businessId;

    const campaign = await hit(
      'POST /api/businesses/:id/campaigns',
      `/api/businesses/${id}/campaigns`,
      {
        method: 'POST',
        body: {
          name: 'Sweep Campaign',
          channel: 'LOCAL_ADS',
          targetSegment: 'REGULAR',
          dailyBudget: 1_500,
          duration: 5,
        },
      },
      [200, 201],
    );
    found.campaignId = campaign.body?.id ?? campaign.body?.campaign?.id ?? '';

    if (found.campaignId) {
      await hit(
        'GET /api/businesses/:id/campaigns/:campaignId',
        `/api/businesses/${id}/campaigns/${found.campaignId}`,
      );
      await hit(
        'PATCH /api/businesses/:id/campaigns/:campaignId',
        `/api/businesses/${id}/campaigns/${found.campaignId}`,
        { method: 'PATCH', body: { action: 'pause' } },
      );
    }

    const loan = await hit(
      'POST /api/loans',
      '/api/loans',
      { method: 'POST', body: { amount: 50_000, days: 10 } },
      [200, 201],
    );
    found.loanId = loan.body?.id ?? '';

    await hit('GET /api/loans', '/api/loans');

    if (found.loanId) {
      await hit(
        'POST /api/loans/:id/repay',
        `/api/loans/${found.loanId}/repay`,
        { method: 'POST', body: { amount: 1000 } },
        [200, 201, 400, 402],
      );
    }

    await hit(
      'POST /api/commerce/store',
      '/api/commerce/store',
      { method: 'POST', body: { sku: 'not-a-real-sku' } },
      // An unknown SKU must be refused, not crash.
      [400, 404, 422],
    );

    await hit(
      'POST /api/commerce/pass',
      '/api/commerce/pass',
      { method: 'POST', body: { tier: 1, lane: 'FREE' } },
      [200, 201, 400, 404, 409, 422],
    );

    await hit(
      'POST /api/commerce/reward',
      '/api/commerce/reward',
      { method: 'POST', body: { placement: 'DAILY_BONUS' } },
      // Ads are off in the harness, so 503 is the correct answer.
      [200, 400, 401, 422, 503],
    );

    expect(since(from), JSON.stringify(since(from), null, 2)).toEqual([]);
  }, 180_000);

  it('runs the classroom', async () => {
    const from = mark();
    const cohort = await hit(
      'POST /api/education/cohorts',
      '/api/education/cohorts',
      {
        method: 'POST',
        body: { name: 'Sweep Class', scenario: 'FIRST_SHOP', seatLimit: 10 },
      },
      [200, 201, 400, 422],
    );

    found.cohortId = cohort.body?.cohort?.id ?? '';
    found.joinCode = cohort.body?.cohort?.joinCode ?? '';

    if (found.cohortId) {
      await hit(
        'GET /api/education/cohorts/:id/gradebook',
        `/api/education/cohorts/${found.cohortId}/gradebook`,
      );
    }

    if (found.joinCode) {
      await hit(
        'POST /api/education/join',
        '/api/education/join',
        { method: 'POST', body: { joinCode: found.joinCode } },
        // Already the owner, so a refusal is correct.
        [200, 201, 400, 409, 422],
      );
    }

    expect(since(from), JSON.stringify(since(from), null, 2)).toEqual([]);
  }, 180_000);

  it('advances the world and reads everything back', async () => {
    const from = mark();
    await hit('POST /api/game/presence', '/api/game/presence', { method: 'POST' });

    const tick = await app.tick();
    results.push({ route: 'POST /api/game/tick', status: tick.status, ok: tick.status === 200 });

    const id = found.businessId;
    await hit('GET /api/businesses/:id (post-tick)', `/api/businesses/${id}`);
    await hit('GET /api/businesses/:id/analytics (post-tick)', `/api/businesses/${id}/analytics`);
    await hit('GET /api/player (post-tick)', '/api/player');
    await hit('GET /api/calendar (post-tick)', '/api/calendar');

    expect(since(from), JSON.stringify(since(from), null, 2)).toEqual([]);
  }, 180_000);

  it('advances the world from a plain GET only when a day is owed', async () => {
    // Vercel Cron issues a `GET` and cannot be asked for a `POST`. This route
    // used to answer that with a status payload and a 200, so the cron
    // dashboard would have stayed green for ever while the game's clock never
    // moved. Nothing would have alerted; the world would simply have frozen.
    //
    // The cron now fires at the fastest cadence the speed dial allows and asks
    // whether a day is actually due. The world just ticked (via POST, above),
    // so the honest answer right now is "not yet" — and that must be a 200
    // with `not-due`, not a tick and not an error.
    const before = await app.api('/api/game/state');

    const notYet = await app.api('/api/game/tick', {
      headers: { Authorization: `Bearer ${app.cronSecret}` },
    });
    expect(notYet.status).toBe(200);
    expect(notYet.body.ticked).toBe(false);
    expect(notYet.body.reason).toBe('not-due');
    expect(notYet.body.speed).toBe(1);

    const after = await app.api('/api/game/state');
    expect(after.body.gameDay, 'a not-due cron firing advanced the world').toBe(before.body.gameDay);

    // An authorized POST is "tick now" and stays unconditional — it is what
    // this harness and a human operator use.
    const forced = await app.tick();
    expect(forced.status).toBe(200);
    const afterForced = await app.api('/api/game/state');
    expect(afterForced.body.gameDay).toBeGreaterThan(after.body.gameDay);
  }, 180_000);

  it('lets the operator set the world speed, and shows it to everyone', async () => {
    // A world dial: one tick moves the day for every player, so the speed is
    // one value for the whole world and every player can read it.
    const open = await app.api('/api/admin/clock');
    expect(open.status).toBe(200);
    expect(open.body.speed).toBe(1);
    expect(open.body.speeds).toEqual([1, 2, 4, 8]);

    const set = await app.api('/api/admin/clock', {
      method: 'POST',
      headers: { Authorization: `Bearer ${app.cronSecret}` },
      body: { speed: 4 },
    });
    expect(set.status).toBe(200);
    expect(set.body.speed).toBe(4);
    expect(set.body.effectiveIntervalMs).toBe(set.body.baseIntervalMs / 4);

    // The state route every client polls reports the same value, and its
    // countdown is now a quarter of the base interval.
    const state = await app.api('/api/game/state');
    expect(state.body.speed).toBe(4);
    expect(state.body.tickIntervalMs).toBe(state.body.baseTickIntervalMs / 4);

    // Back to 1x so nothing later in this file inherits a faster world.
    const reset = await app.api('/api/admin/clock', {
      method: 'POST',
      headers: { Authorization: `Bearer ${app.cronSecret}` },
      body: { speed: 1 },
    });
    expect(reset.body.speed).toBe(1);
  }, 120_000);

  it('refuses a speed that is not on the dial, and anyone without the secret', async () => {
    const bogus = await app.api('/api/admin/clock', {
      method: 'POST',
      headers: { Authorization: `Bearer ${app.cronSecret}` },
      body: { speed: 3 },
    });
    expect(bogus.status).toBe(400);

    const anonymous = await app.api('/api/admin/clock', {
      method: 'POST',
      body: { speed: 8 },
    });
    expect(anonymous.status).toBe(401);

    // Neither attempt moved the dial.
    const after = await app.api('/api/admin/clock');
    expect(after.body.speed).toBe(1);
  }, 120_000);

  it('reports the world as running even with no in-process scheduler', async () => {
    // The Vercel case, exactly as this harness runs: GAME_TICK_SCHEDULER=off,
    // the world advanced by an outside caller. Every player used to see
    // "Clock paused" and no countdown while the cron ticked the world
    // underneath them.
    const state = await app.api('/api/game/state');
    expect(state.body.clockRunning).toBe(true);
    expect(state.body.nextTickAt).not.toBeNull();
  }, 120_000);

  it('still reports the clock to an unauthenticated GET, without moving it', async () => {
    // The status payload is how you confirm a deployment is actually ticking,
    // so it stays open — and reading it must not be a way to drive the world.
    const before = await app.api('/api/game/state');

    const status = await app.api('/api/game/tick');
    expect(status.status).toBe(200);
    expect(status.body).toHaveProperty('schedulerEnabled');
    expect(status.body).toHaveProperty('tickIntervalMs');
    expect(status.body.ticked).toBeUndefined();

    const after = await app.api('/api/game/state');
    expect(after.body.gameDay, 'an anonymous GET advanced the world').toBe(before.body.gameDay);
  }, 120_000);

  it('refuses a GET carrying the wrong secret', async () => {
    const before = await app.api('/api/game/state');

    const wrong = await app.api('/api/game/tick', {
      headers: { Authorization: 'Bearer not-the-cron-secret' },
    });
    // Falls through to the status payload rather than ticking.
    expect(wrong.body.ticked).toBeUndefined();

    const after = await app.api('/api/game/state');
    expect(after.body.gameDay).toBe(before.body.gameDay);
  }, 120_000);

  it('renders every screen', async () => {
    const from = mark();
    for (const route of [
      '/',
      '/dashboard',
      '/businesses',
      '/businesses/new',
      '/portfolio',
      '/market',
      '/competition',
      '/bank',
      '/leaderboard',
      '/news',
      '/calendar',
      '/achievements',
      '/store',
      '/classroom',
      '/settings',
    ]) {
      await hit(`PAGE ${route}`, route);
    }

    await hit('PAGE /businesses/:id', `/businesses/${found.businessId}`);

    expect(since(from), JSON.stringify(since(from), null, 2)).toEqual([]);
  }, 300_000);

  it('cleans up the destructive routes last', async () => {
    const from = mark();
    const id = found.businessId;

    if (found.employeeId) {
      await hit(
        'DELETE /api/businesses/:id/employees/:empId',
        `/api/businesses/${id}/employees/${found.employeeId}`,
        { method: 'DELETE' },
        [200, 204],
      );
    }

    await hit(
      'POST /api/businesses/:id/sell',
      `/api/businesses/${id}/sell`,
      { method: 'POST' },
      [200, 201],
    );

    await hit('POST /api/auth/logout', '/api/auth/logout', { method: 'POST' }, [200, 204]);

    expect(since(from), JSON.stringify(since(from), null, 2)).toEqual([]);
  }, 180_000);
});
