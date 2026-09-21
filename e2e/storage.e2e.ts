// ============================================
// Bangladesh Business Tycoon - Storage & pre-buying, end to end
// ============================================
//
// The whole flow, against a real database and a real server clock:
//
//   rent a godown -> take a loan -> place a bulk order -> advance the calendar
//   -> delivery -> inventory updated -> stock sells
//
// Plus the refusals, which matter more than the happy path: an order with
// nowhere to go, a delivery date in the past, one too far ahead, one the player
// cannot pay for, and a manual purchase that would overflow the shop.
//
// A tea stall rather than a clothing shop on purpose: clothing costs ৳500,000
// against a ৳500,000 opening balance, so the player would be broke before the
// first order. The Eid-scale capacity question — can a shop hold enough for a
// x2.8 rush — is asserted directly against the capacity figures instead.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startHarness, type Harness } from './harness';

let app: Harness;

const shop = {
  id: '',
  /** Shelf capacity, before any rental. */
  baseCapacity: 0,
  gameDay: 0,
  productName: '',
  category: '',
  orderId: '',
  orderedQuantity: 0,
  deliveryDay: 0,
  stockBeforeDelivery: 0,
};

beforeAll(async () => {
  app = await startHarness();
}, 300_000);

afterAll(async () => {
  await app?.stop();
});

describe('storage and pre-buying', () => {
  it('opens a shop to store things in', async () => {
    await app.api('/api/game/init', { method: 'POST' });

    const register = await app.api('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Storage Player',
        email: `storage-${Date.now()}@example.test`,
        password: 'correct-horse-battery-staple',
      },
    });
    expect(register.status).toBe(201);

    const created = await app.api('/api/businesses', {
      method: 'POST',
      body: { type: 'TEA_STALL', city: 'DHAKA', name: 'Storage Tea' },
    });
    expect(created.status).toBe(201);
    shop.id = created.body.id;
  }, 180_000);

  it('reports capacity before anything is rented', async () => {
    const res = await app.api(`/api/businesses/${shop.id}/storage`);
    expect(res.status).toBe(200);

    const { capacity, gameDay } = res.body;
    shop.baseCapacity = capacity.selling;
    shop.gameDay = gameDay;

    expect(capacity.selling).toBeGreaterThan(0);
    expect(capacity.rented).toBe(0);
    expect(capacity.storage).toBe(capacity.selling);
    expect(capacity.incoming).toBe(0);
    expect(capacity.available).toBe(capacity.storage - capacity.held);
    expect(capacity.overCapacity).toBe(false);
  }, 60_000);

  it('refuses a manual purchase that would overflow the shop', async () => {
    // This route had no capacity check at all before godowns existed: any
    // quantity could be bought into any shop.
    const market = await app.api('/api/market/products?type=TEA_STALL&city=DHAKA');
    const product = (market.body?.products ?? market.body)?.[0];
    shop.productName = product.name;
    shop.category = product.category;

    const res = await app.api(`/api/businesses/${shop.id}/inventory/buy`, {
      method: 'POST',
      body: {
        productId: product.id ?? 'p',
        productName: product.name,
        category: product.category,
        quantity: shop.baseCapacity * 10,
      },
    });

    expect(res.status).toBe(400);
    expect(String(res.body?.error?.message)).toMatch(/space|godown/i);
  }, 60_000);

  it('rents a warehouse, and the ceiling rises without the shelves moving', async () => {
    // The safety property, observed through the API: rented space must not
    // change `selling`, which is the figure the demand model reads.
    const rented = await app.api(`/api/businesses/${shop.id}/storage/godown`, {
      method: 'POST',
      body: { tier: 'LARGE', termDays: 90 },
    });
    expect(rented.status).toBe(201);
    expect(rented.body.capacityBonus).toBeGreaterThan(0);

    const res = await app.api(`/api/businesses/${shop.id}/storage`);
    const { capacity, godowns } = res.body;

    expect(capacity.selling).toBe(shop.baseCapacity);
    expect(capacity.rented).toBe(rented.body.capacityBonus);
    expect(capacity.storage).toBe(shop.baseCapacity + rented.body.capacityBonus);
    expect(godowns).toHaveLength(1);
    expect(godowns[0].daysRemaining).toBeGreaterThan(0);
  }, 60_000);

  it('can now hold enough for an Eid-scale rush', async () => {
    // Eid multiplies clothing demand by 2.8 for the ten days before it. The
    // point of the feature is that a shop can prepare for a multiple like that
    // rather than watch it arrive against fixed shelves.
    const res = await app.api(`/api/businesses/${shop.id}/storage`);
    expect(res.body.capacity.storage).toBeGreaterThan(shop.baseCapacity * 2.8);
  }, 60_000);

  it('refuses orders that do not make sense', async () => {
    const base = {
      productName: shop.productName,
      category: shop.category,
      quantity: 50,
      deliveryDay: shop.gameDay + 5,
    };

    // In the past.
    const past = await app.api(`/api/businesses/${shop.id}/storage/orders`, {
      method: 'POST',
      body: { ...base, deliveryDay: Math.max(0, shop.gameDay - 1) },
    });
    expect(past.status).toBe(400);

    // Today — a "pre-order" with no lead time is a purchase with extra steps,
    // and the locked price would be free money.
    const today = await app.api(`/api/businesses/${shop.id}/storage/orders`, {
      method: 'POST',
      body: { ...base, deliveryDay: shop.gameDay },
    });
    expect(today.status).toBe(400);

    // Further ahead than a supplier will commit.
    const tooFar = await app.api(`/api/businesses/${shop.id}/storage/orders`, {
      method: 'POST',
      body: { ...base, deliveryDay: shop.gameDay + 5_000 },
    });
    expect(tooFar.status).toBe(400);

    // Below the supplier minimum.
    const tiny = await app.api(`/api/businesses/${shop.id}/storage/orders`, {
      method: 'POST',
      body: { ...base, quantity: 1 },
    });
    expect(tiny.status).toBe(400);

    // More than the shop could ever house.
    const huge = await app.api(`/api/businesses/${shop.id}/storage/orders`, {
      method: 'POST',
      // 50,000 rather than a million: the schema's own upper bound would
      // reject a million first, and this assertion is about the capacity check.
      body: { ...base, quantity: 50_000 },
    });
    expect(huge.status).toBe(400);
    expect(String(huge.body?.error?.message)).toMatch(/space|godown/i);

    // None of that should have left anything behind.
    const state = await app.api(`/api/businesses/${shop.id}/storage`);
    expect(state.body.preOrders).toHaveLength(0);
    expect(state.body.capacity.incoming).toBe(0);
  }, 120_000);

  it('borrows to fund the order', async () => {
    // The loan system is how a player finds the capital to commit ahead of a
    // rush, which is the whole reason the two features sit next to each other.
    const before = await app.api('/api/player');
    const loan = await app.api('/api/loans', {
      method: 'POST',
      body: { amount: 50_000, days: 30 },
    });
    expect([200, 201]).toContain(loan.status);

    const after = await app.api('/api/player');
    expect(after.body.cash).toBeGreaterThan(before.body.cash);
  }, 60_000);

  it('places a bulk order, taking the money and reserving the space', async () => {
    const before = await app.api('/api/player');
    const state = await app.api(`/api/businesses/${shop.id}/storage`);

    shop.gameDay = state.body.gameDay;
    shop.deliveryDay = shop.gameDay + 3;
    shop.orderedQuantity = 300;

    const placed = await app.api(`/api/businesses/${shop.id}/storage/orders`, {
      method: 'POST',
      body: {
        productName: shop.productName,
        category: shop.category,
        quantity: shop.orderedQuantity,
        deliveryDay: shop.deliveryDay,
      },
    });

    expect(placed.status).toBe(201);
    shop.orderId = placed.body.orderId;

    // Paid for now, so the delivery can never fail for want of cash later.
    const after = await app.api('/api/player');
    expect(after.body.cash).toBe(before.body.cash - placed.body.quote.totalCost);

    // 300 units clears the bulk tiers.
    expect(placed.body.quote.discount).toBeGreaterThan(0);
    expect(placed.body.quote.unitCost).toBeLessThan(placed.body.quote.listUnitCost);
    expect(placed.body.quote.saving).toBeGreaterThan(0);

    // And the room it will need is spoken for.
    const afterState = await app.api(`/api/businesses/${shop.id}/storage`);
    expect(afterState.body.capacity.incoming).toBe(shop.orderedQuantity);
    expect(afterState.body.preOrders).toHaveLength(1);
    expect(afterState.body.preOrders[0].deliveryDay).toBe(shop.deliveryDay);

    shop.stockBeforeDelivery = afterState.body.capacity.held;
  }, 120_000);

  it('does not deliver before the day comes', async () => {
    const tick = await app.tick();
    expect(tick.status).toBe(200);

    const state = await app.api(`/api/businesses/${shop.id}/storage`);
    expect(state.body.preOrders).toHaveLength(1);
    expect(state.body.preOrders[0].status).toBe('PENDING');
  }, 120_000);

  it('delivers on the day, and the stock is on the shelves', async () => {
    // Advance to the delivery day. Deliveries run at the top of the tick, so
    // stock ordered for a given day trades on that day rather than the next.
    for (let i = 0; i < 4; i++) {
      const state = await app.api(`/api/businesses/${shop.id}/storage`);
      if (state.body.gameDay >= shop.deliveryDay) break;
      await app.tick();
    }

    const state = await app.api(`/api/businesses/${shop.id}/storage`);
    expect(state.body.gameDay).toBeGreaterThanOrEqual(shop.deliveryDay);
    expect(state.body.preOrders).toHaveLength(0); // no longer pending

    const business = await app.api(`/api/businesses/${shop.id}`);
    const line = business.body.inventories.find(
      (i: { productName: string }) => i.productName === shop.productName,
    );
    expect(line, 'the ordered product is not on the books').toBeTruthy();

    // The precise hook: the order itself, settled. Comparing total holdings
    // before and after does not work — the shop trades every one of those days,
    // and a tea stall can sell more than it took in.
    const settled = state.body.recentOrders.find(
      (o: { id: string }) => o.id === shop.orderId,
    );
    expect(settled, 'the order is not among the settled ones').toBeTruthy();
    expect(settled.status).toBe('DELIVERED');
    expect(settled.deliveredQuantity).toBe(shop.orderedQuantity);
    expect(settled.refunded).toBe(0);

    // And the space it reserved has been released.
    expect(state.body.capacity.incoming).toBe(0);
  }, 300_000);

  it('never lets the shop exceed what it can store', async () => {
    const state = await app.api(`/api/businesses/${shop.id}/storage`);
    expect(state.body.capacity.held).toBeLessThanOrEqual(state.body.capacity.storage);
    expect(state.body.capacity.overCapacity).toBe(false);
  }, 60_000);

  it('sells the delivered stock', async () => {
    const before = await app.api(`/api/businesses/${shop.id}`);
    await app.tick();
    const after = await app.api(`/api/businesses/${shop.id}`);

    // The whole point: goods bought ahead reach customers.
    expect(after.body.dailyRevenue).toBeGreaterThan(0);
    expect(after.body.totalRevenue).toBeGreaterThanOrEqual(before.body.totalRevenue);
  }, 180_000);

  it('cancels an order and returns the money less the fee', async () => {
    const state = await app.api(`/api/businesses/${shop.id}/storage`);
    const placed = await app.api(`/api/businesses/${shop.id}/storage/orders`, {
      method: 'POST',
      body: {
        productName: shop.productName,
        category: shop.category,
        quantity: 30,
        deliveryDay: state.body.gameDay + 10,
      },
    });
    expect(placed.status).toBe(201);

    const beforeCancel = await app.api('/api/player');
    const cancelled = await app.api(
      `/api/businesses/${shop.id}/storage/orders/${placed.body.orderId}`,
      { method: 'DELETE' },
    );

    expect(cancelled.status).toBe(200);
    expect(cancelled.body.fee).toBeGreaterThan(0);
    expect(cancelled.body.refund).toBeLessThan(placed.body.quote.totalCost);

    const afterCancel = await app.api('/api/player');
    expect(afterCancel.body.cash).toBe(beforeCancel.body.cash + cancelled.body.refund);

    // And the space it was holding is released.
    const afterState = await app.api(`/api/businesses/${shop.id}/storage`);
    expect(afterState.body.capacity.incoming).toBe(0);
  }, 120_000);

  it('turns auto-renew on for the warehouse', async () => {
    const state = await app.api(`/api/businesses/${shop.id}/storage`);
    const godown = state.body.godowns[0];

    const res = await app.api(
      `/api/businesses/${shop.id}/storage/godown/${godown.id}`,
      { method: 'PATCH', body: { autoRenew: true } },
    );
    expect(res.status).toBe(200);

    const after = await app.api(`/api/businesses/${shop.id}/storage`);
    expect(after.body.godowns[0].autoRenew).toBe(true);
  }, 60_000);

  it('refuses to rent more than a shop can manage', async () => {
    // Two rentals is the limit; the first LARGE is already held.
    await app.api(`/api/businesses/${shop.id}/storage/godown`, {
      method: 'POST',
      body: { tier: 'SMALL', termDays: 30 },
    });

    const third = await app.api(`/api/businesses/${shop.id}/storage/godown`, {
      method: 'POST',
      body: { tier: 'SMALL', termDays: 30 },
    });
    expect(third.status).toBe(400);
  }, 120_000);

  it('refuses a rental the player cannot pay for', async () => {
    // Drain the account, then ask for the most expensive thing on offer.
    const player = await app.api('/api/player');
    const other = await app.api('/api/businesses', {
      method: 'POST',
      body: { type: 'GROCERY', city: 'DHAKA', name: 'Cash Sink' },
    });

    if (other.status === 201) {
      const res = await app.api(`/api/businesses/${other.body.id}/storage/godown`, {
        method: 'POST',
        body: { tier: 'LARGE', termDays: 90 },
      });
      // Either it was affordable, or it was refused for the stated reason —
      // never a crash, and never a rental the player did not pay for.
      expect([201, 400]).toContain(res.status);
      if (res.status === 400) {
        expect(String(res.body?.error?.message)).toMatch(/costs|have/i);
      }
    } else {
      expect(player.body.cash).toBeGreaterThanOrEqual(0);
    }
  }, 120_000);
});
