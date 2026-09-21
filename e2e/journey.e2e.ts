// ============================================
// Bangladesh Business Tycoon - The Player Journey
// ============================================
//
// Sign up → open a shop → buy stock → advance the clock → read the dashboard.
//
// One test, driven over HTTP against a real server and a real Postgres. It
// exists because of a pattern in this repository's defect history: almost
// everything serious that shipped was invisible to unit tests and obvious
// within a minute of actually playing.
//
//   * The player's level was frozen at 1, so expansion, the portfolio screen
//     and the multi-business achievements were all dead code.
//   * Daily profit was counted twice into net worth, inflating every save.
//   * Opening stock was gifted rather than charged, and could be sold back at
//     70% — an arbitrage loop that minted cash out of nothing.
//   * The analytics endpoint reported rent, salaries, utilities and tax as
//     literal zeros while looking perfectly healthy.
//
// Every one of those lives in the seam between two pieces that are each fine on
// their own. This test walks the seam.
//
// It earned its keep on its first proper run by finding a fifth: opening stock
// was written with `productId: ''`, and `POST /inventory/buy` matches an
// existing shelf on exactly that column — so the first restock of anything a
// shop opened with silently created a SECOND row for the same product, which
// the tick then treats as a second shelf with its own demand and its own price.
// See the `duplicate` assertion below.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startHarness, type Harness } from './harness';

const TEA_STALL_INVESTMENT = 50_000;
const STARTING_CASH = 500_000;

let app: Harness;

/** Filled in as the journey progresses; later steps read earlier results. */
const journey = {
  businessId: '',
  cashAfterOpening: 0,
  netWorthBeforeTicks: 0,
  xpBeforeTicks: 0,
};

beforeAll(async () => {
  app = await startHarness();
}, 300_000);

afterAll(async () => {
  await app?.stop();
});

describe('the player journey', () => {
  it('seeds the world', async () => {
    const res = await app.api('/api/game/init', { method: 'POST' });
    expect(res.status).toBe(200);
  }, 120_000);

  it('records an anonymous visit before anyone signs up', async () => {
    // The first funnel step happens before an account exists. This is the
    // browser's beacon: it must be accepted without a session, and it must
    // hand back the anonymous cookie that the sign-up below stitches to.
    const res = await app.api('/api/analytics/collect', {
      method: 'POST',
      body: {
        events: [
          { name: 'visited' },
          { name: 'screen_viewed', props: { screen: '/' } },
          // Rejected: a browser does not get to claim it paid for something.
          { name: 'purchase_completed', props: { sku: 'free-money' } },
        ],
      },
    });

    expect(res.status).toBe(204);
  }, 60_000);

  it('signs a new player up with the starting balance', async () => {
    const res = await app.api('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'E2E Player',
        email: `e2e-${Date.now()}@example.test`,
        password: 'correct-horse-battery-staple',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body?.player?.netWorth).toBe(STARTING_CASH);
    expect(res.body?.player?.level).toBe(1);
  }, 60_000);

  it('opens the dashboard data for that player', async () => {
    const res = await app.api('/api/player');

    expect(res.status).toBe(200);
    expect(res.body.cash).toBe(STARTING_CASH);
    expect(res.body.level).toBe(1);
    expect(res.body.experience).toBe(0);
  }, 60_000);

  it('charges for the shop AND its opening stock', async () => {
    // The arbitrage loop: stock used to be handed over free, then sellable back
    // at 70%. Opening a shop therefore had to cost strictly more than the bare
    // investment, or the stock is being given away again.
    const before = await app.api('/api/player');

    const created = await app.api('/api/businesses', {
      method: 'POST',
      body: { type: 'TEA_STALL', city: 'DHAKA', name: 'E2E Tea Stall' },
    });
    expect(created.status).toBe(201);
    journey.businessId = created.body.id;

    const after = await app.api('/api/player');
    journey.cashAfterOpening = after.body.cash;

    const spent = before.body.cash - after.body.cash;
    expect(spent).toBeGreaterThan(TEA_STALL_INVESTMENT);
  }, 60_000);

  it('stocks the shelves at opening', async () => {
    const res = await app.api(`/api/businesses/${journey.businessId}`);

    expect(res.status).toBe(200);
    const inventories = res.body.inventories ?? [];
    expect(inventories.length).toBeGreaterThan(0);
    expect(inventories.reduce((sum: number, i: any) => sum + i.quantity, 0)).toBeGreaterThan(0);
  }, 60_000);

  it('gives every opening shelf a real product id', async () => {
    // Guards the seam directly: `POST /inventory/buy` looks a shelf up by
    // `productId`, so an empty one here means the next restock silently creates
    // a duplicate shelf instead of topping this one up.
    const res = await app.api(`/api/businesses/${journey.businessId}`);
    for (const inventory of res.body.inventories ?? []) {
      expect(inventory.productId, `${inventory.productName} has no product id`).toBeTruthy();
    }
  }, 60_000);

  it('restocks an existing shelf without duplicating it', async () => {
    const before = await app.api(`/api/businesses/${journey.businessId}`);
    const rowsFor = (body: any, name: string) =>
      (body.inventories ?? []).filter((i: any) => i.productName === name);

    const target = (before.body.inventories ?? [])[0];
    expect(target).toBeDefined();

    // Bought the way the UI does it — with the id from the market listing,
    // not the one already on the shelf.
    const market = await app.api(`/api/market/products?type=TEA_STALL&city=DHAKA`);
    const listed = (Array.isArray(market.body) ? market.body : []).find(
      (p: any) => p.name === target.productName,
    );
    expect(listed?.id, 'product missing from the market listing').toBeTruthy();

    const bought = await app.api(`/api/businesses/${journey.businessId}/inventory/buy`, {
      method: 'POST',
      body: {
        productId: listed.id,
        productName: target.productName,
        category: target.category,
        quantity: 40,
      },
    });
    expect(bought.status).toBe(201);

    const after = await app.api(`/api/businesses/${journey.businessId}`);

    // The bug this test found: one shelf in, two shelves out.
    expect(
      rowsFor(after.body, target.productName).length,
      `restocking ${target.productName} created a duplicate shelf`,
    ).toBe(rowsFor(before.body, target.productName).length);

    const quantityBefore = rowsFor(before.body, target.productName)[0].quantity;
    const quantityAfter = rowsFor(after.body, target.productName)[0].quantity;
    expect(quantityAfter).toBe(quantityBefore + 40);
  }, 60_000);

  it('fills every shelf with the bulk restock', async () => {
    // What a player does before expecting the shop to earn anything — and the
    // reason the next assertion is meaningful: a shop trading on its opening
    // stock alone runs at a loss, so no profitable-day XP would be awarded and
    // "the XP bar moves" would prove nothing.
    const res = await app.api(`/api/businesses/${journey.businessId}/inventory/restock`, {
      method: 'POST',
      body: { target: 1 },
    });

    expect(res.status).toBe(200);
    expect(res.body.restocked).toBe(true);
    expect(res.body.unitsBought).toBeGreaterThan(0);
  }, 60_000);

  it('puts the shop on a standing restock order', async () => {
    // Once demand was fixed a tea stall empties its shelves in about a day, so
    // a shop that is stocked once and left alone spends the rest of the week
    // taking visitors it has nothing to sell.
    //
    // This is the *emergency* top-up, not a buying strategy: it waits until a
    // shelf is nearly bare, refills it barely, and pays the counter's quarter
    // premium. It keeps an unattended shop trading, which is what this test
    // needs; buying properly is the supplier screen's job, and a player who
    // leans on this instead will earn visibly less.
    const res = await app.api(`/api/businesses/${journey.businessId}/inventory/restock`, {
      method: 'PUT',
      body: {
        autoRestock: true,
        autoRestockThreshold: 0.5,
        autoRestockTarget: 1,
        autoRestockBudget: null,
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.settings.autoRestock).toBe(true);
  }, 60_000);

  it('advances the clock', async () => {
    const before = await app.api('/api/game/state');
    const player = await app.api('/api/player');
    journey.netWorthBeforeTicks = player.body.netWorth;
    journey.xpBeforeTicks = player.body.experience;

    for (let day = 0; day < 3; day++) {
      const tick = await app.tick();
      expect(tick.status).toBe(200);
    }

    const after = await app.api('/api/game/state');
    expect(after.body.gameDay).toBe(before.body.gameDay + 3);
  }, 180_000);

  it('runs the day inside a season', async () => {
    const res = await app.api('/api/game/state');
    expect(res.body.season).toBeTruthy();
    expect(res.body.season.number).toBe(1);
    expect(res.body.season.daysRemaining).toBeLessThan(res.body.season.lengthDays);
  }, 60_000);

  it('moves the experience bar', async () => {
    // "Player level is permanently 1" made expansion, the portfolio screen and
    // the multi-business achievements unreachable, and showed the player an XP
    // bar that never moved.
    //
    // Two things are asserted, because they fail differently: XP existing at
    // all proves the awarding pipeline is wired up, and XP rising across
    // trading days proves the tick is the thing driving it.
    const res = await app.api('/api/player');

    // XP existing at all proves the awarding pipeline is wired up, which is the
    // defect that mattered: `awardExperience` was never called, so level was
    // pinned at 1 and expansion, the portfolio and the multi-business
    // achievements were unreachable.
    //
    // The stronger assertion, now that it can be made honestly: profitable-day
    // XP only fires on a profitable day, and a fully stocked tea stall trades
    // at a profit again since the segment-demand term was fixed. Before that it
    // could only be asserted that XP existed at all.
    expect(res.body.experience).toBeGreaterThan(0);
    expect(
      res.body.experience,
      'trading days stopped adding XP — the tick is no longer driving progression',
    ).toBeGreaterThan(journey.xpBeforeTicks);
  }, 60_000);

  it('serves a real share of its market, and trades at a profit', async () => {
    // ---- What this used to pin, and what it pins now ----
    //
    // This was a ratchet on a defect (U2). A fully stocked tea stall holding
    // 47% of a 112-customer Dhaka market served about **9 customers a day** —
    // ~8% of the market, a ~12x suppression — and therefore traded at a loss
    // however well it was run. The core loop of the game did not work.
    //
    // The cause was `segmentDemandModifier`: the sum of the raw segment scores,
    // which is 1.0 only when every factor is perfect and ~0.10 for a new shop.
    // It was a penalty multiplied onto a base that had already counted the same
    // employees and reputation. It is now normalised against an ordinary shop —
    // see `calculateSegmentDemandModifier`.
    //
    // Measured after the fix: **71 of 112 customers (63%), ৳825 profit a day**.
    // The bounds below are a ratchet on that, in both directions: a collapse
    // back towards 8% fails, and so does an unbounded runaway.
    const business = await app.api(`/api/businesses/${journey.businessId}`);
    const market = await app.api('/api/market/competition?city=DHAKA&type=TEA_STALL');

    const served = business.body.dailyCustomers;
    const marketDemand = market.body.totalDemand;

    expect(served, 'the shop served nobody at all').toBeGreaterThan(0);
    expect(marketDemand).toBeGreaterThan(0);

    // ---- The screen must not contradict the simulation (U3) ----
    //
    // `totalDemand` used to be `baseCustomers x cityMultiplier` — one shop's
    // base, before every modifier the tick applies — so once shops traded
    // properly a single tea stall served 130 customers out of a "112-customer
    // market". It is now the customers the market actually served, so no shop
    // can exceed it.
    // ---- Why the ratchet is on customers, not on share ----
    //
    // `marketDemand` is now the customers the whole market actually served, so
    // it grows with the number of AI tea stalls the world happens to seed in
    // Dhaka. Measured across six runs it ranged 205-840 while the player's own
    // shop stayed at 97-185 customers and ৳1,272-3,241 profit. A floor on
    // *share* therefore fails whenever the world is crowded, which says nothing
    // about whether this shop works — the exact false alarm the U2 ratchet was
    // meant to avoid. The floor belongs on the two figures that were broken.
    const share = served / marketDemand;
    expect(served, 'the shop has fallen back towards serving almost nobody').toBeGreaterThan(50);
    expect(share, 'a shop is serving more customers than its whole market has').toBeLessThanOrEqual(1);

    // The thing that was actually broken: a well-stocked shop must be able to
    // earn. Asserted on the business, not on net worth, so a loss cannot hide
    // behind the player's opening balance.
    expect(
      business.body.dailyProfit,
      'a fully stocked shop is trading at a loss again',
    ).toBeGreaterThan(0);
  }, 60_000);

  it('sweeps the till instead of counting profit twice', async () => {
    // Profit used to be mirrored into both the business and the player, so net
    // worth grew by twice what was earned. The fix sweeps the till each tick,
    // which is observable: a business should be holding nothing.
    const res = await app.api(`/api/businesses/${journey.businessId}`);
    expect(res.body.cash).toBe(0);
  }, 60_000);

  it('keeps net worth equal to what the player actually holds', async () => {
    // netWorth = cash + business cash + stock at cost - debt.
    // Asserting the identity catches drift in either direction, including a
    // stale figure that never got recalculated.
    const player = await app.api('/api/player');
    const businesses = await app.api('/api/businesses');

    let businessCash = 0;
    let stockAtCost = 0;
    for (const summary of businesses.body ?? []) {
      const detail = await app.api(`/api/businesses/${summary.id}`);
      businessCash += detail.body.cash ?? 0;
      for (const inventory of detail.body.inventories ?? []) {
        stockAtCost += inventory.quantity * inventory.purchasePrice;
      }
    }

    const expected = player.body.cash + businessCash + stockAtCost;
    expect(player.body.netWorth).toBeCloseTo(expected, 0);
  }, 120_000);

  it('reports what the shop actually spends, not zeros', async () => {
    // The analytics endpoint returned literal zeros for rent, salaries,
    // utilities and tax for months. The endpoint looked healthy; the player
    // could see a shop cost money and never what it spent it on.
    const res = await app.api(`/api/businesses/${journey.businessId}/analytics`);
    expect(res.status).toBe(200);

    const breakdown = res.body.financialBreakdown ?? res.body.data?.financialBreakdown;
    expect(breakdown, 'analytics returned no financial breakdown').toBeTruthy();

    expect(breakdown.rent, 'rent reported as zero').toBeGreaterThan(0);
    expect(breakdown.utilities, 'utilities reported as zero').toBeGreaterThan(0);

    // Utilities are a monthly bill divided by 30, like rent. The tea stall's
    // electricity used to be read per-day, making it seven times its rent.
    expect(breakdown.utilities).toBeLessThan(breakdown.rent);
  }, 60_000);

  it('refuses the analytics report without the token', async () => {
    const anonymous = await app.api('/api/analytics/report');
    expect(anonymous.status).toBe(401);

    const wrong = await app.api('/api/analytics/report', {
      headers: { Authorization: 'Bearer not-the-token' },
    });
    expect(wrong.status).toBe(401);
  }, 60_000);

  it('reports the onboarding funnel this journey just walked', async () => {
    // The point of the whole analytics layer, exercised through the real
    // stack. Every step below was produced by an earlier test in this file
    // doing the ordinary thing — none of it was recorded by this test.
    const res = await app.api('/api/analytics/report?days=7', {
      headers: { Authorization: `Bearer ${app.analyticsToken}` },
    });

    expect(res.status).toBe(200);

    const steps: Record<string, number> = {};
    for (const step of res.body.onboarding) steps[step.name] = step.users;

    expect(steps.visited).toBeGreaterThanOrEqual(1);
    expect(steps.signed_up).toBeGreaterThanOrEqual(1);
    expect(steps.first_business_opened).toBeGreaterThanOrEqual(1);
    expect(steps.first_stock_bought).toBeGreaterThanOrEqual(1);

    // The stitch, asserted where it can actually fail. Counting the steps does
    // not test it: an unstitched run still reports 1 visitor and 1 sign-up,
    // just two different people. Distinct actors is the discriminator — this
    // journey is one browser that became one account, so it must read 1, and
    // reads 2 the moment `visited` stops connecting to the account it became.
    expect(res.body.sessions.actors).toBe(1);
    expect(res.body.retention.cohorts).toHaveLength(1);

    // Non-increasing, always. A funnel that widens is a broken funnel.
    const users = res.body.onboarding.map((step: { users: number }) => step.users);
    for (let i = 1; i < users.length; i++) {
      expect(users[i]).toBeLessThanOrEqual(users[i - 1]);
    }
  }, 60_000);

  it('never rewards a client for claiming an event it cannot observe', async () => {
    const res = await app.api('/api/analytics/report?days=7', {
      headers: { Authorization: `Bearer ${app.analyticsToken}` },
    });

    // The beacon at the top of this file tried to report `purchase_completed`.
    // Nothing in this journey bought anything, so the purchase funnel must
    // still read zero conversions.
    const completed = res.body.purchase.find(
      (step: { name: string }) => step.name === 'purchase_completed',
    );
    expect(completed.users).toBe(0);
  }, 60_000);

  it('records no personal data', async () => {
    // The player registered with a real-looking name and email. Neither may
    // appear anywhere in the analytics the report can reach.
    const res = await app.api('/api/analytics/report?days=7', {
      headers: { Authorization: `Bearer ${app.analyticsToken}` },
    });

    const serialised = JSON.stringify(res.body);
    expect(serialised).not.toContain('@example.test');
    expect(serialised).not.toContain('E2E Player');
    expect(serialised.toLowerCase()).not.toContain('correct-horse');
  }, 60_000);

  it('tells the player what day it is in Bangladesh', async () => {
    const res = await app.api('/api/calendar');
    expect(res.status).toBe(200);

    // The world runs on the season's own clock, so the date the economy uses
    // is the season's start plus its game day — not the server's wall clock.
    expect(res.body.world.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.world.bengali.year).toBeGreaterThan(1400);
    expect(res.body.world.bengali.monthBn).toMatch(/[ঀ-৿]/);
    expect(res.body.world.bengali.formattedBn).toMatch(/[০-৯]/); // Bengali numerals
    expect(res.body.world.bengali.season.id).toBeTruthy();
  }, 60_000);

  it('never presents a moon-sighting date as settled', async () => {
    // The invariant this whole feature is written around (CAL3). An estimated
    // Eid rendered like Victory Day is the failure that matters.
    const res = await app.api('/api/calendar');

    const all = [...res.body.year.observances, ...res.body.today, ...res.body.upcoming];
    expect(all.length).toBeGreaterThan(0);

    for (const observance of all) {
      expect(['FIXED', 'CONFIRMED', 'ESTIMATED']).toContain(observance.certainty);
      if (observance.certainty === 'ESTIMATED') {
        expect(observance.window, `${observance.id} is an estimate with no window`).toBeTruthy();
        expect(observance.window.earliest < observance.date).toBe(true);
        expect(observance.window.latest > observance.date).toBe(true);
      } else {
        expect(observance.window).toBeNull();
      }
    }
  }, 60_000);

  it('serves a whole Bangladeshi year, for a year nobody has confirmed', async () => {
    // The dates-roll-forward requirement, through the real endpoint. 2044 is
    // far outside the gazette table, so everything Islamic must be estimated
    // and the national days must still be exact.
    const res = await app.api('/api/calendar?year=2044');
    expect(res.status).toBe(200);

    const byId = new Map<string, any>(
      res.body.year.observances.map((o: any) => [o.id, o]),
    );

    expect(byId.get('VICTORY_DAY').date).toBe('2044-12-16');
    expect(byId.get('INDEPENDENCE_DAY').date).toBe('2044-03-26');
    expect(byId.get('POHELA_BOISHAKH').date).toBe('2044-04-14');
    expect(byId.get('EID_UL_FITR').certainty).toBe('ESTIMATED');

    // Announced-only dates are absent rather than invented.
    expect(byId.has('DURGA_PUJA')).toBe(false);
  }, 60_000);

  it('moves demand without inventing any', async () => {
    // CAL4, end to end. Every trade gets a multiplier, and none of them is
    // outside the bounds the module states.
    const res = await app.api('/api/calendar');

    for (const trade of ['TEA_STALL', 'GROCERY', 'CLOTHING', 'MOBILE', 'RESTAURANT']) {
      const demand = res.body.demand[trade];
      expect(demand, trade).toBeTruthy();
      expect(Number.isFinite(demand.multiplier)).toBe(true);
      expect(demand.multiplier).toBeGreaterThan(0.1);
      expect(demand.multiplier).toBeLessThan(4);
    }
  }, 60_000);

  it('serves the calendar screen', async () => {
    const res = await app.api('/calendar');
    expect(res.status).toBe(200);
  }, 60_000);

  it('serves the dashboard to a signed-in player', async () => {
    // A smoke check on the rendered route, not just the API behind it: the
    // server-side guard resolves the player before any game chrome renders, so
    // a 200 here means that path works end to end.
    const res = await app.api('/dashboard');
    expect(res.status).toBe(200);
  }, 60_000);
});
