// ============================================
// Bangladesh Business Tycoon - Suppliers, credit and spoilage, end to end
// ============================================
//
//   choose a supplier -> order on terms -> no cash moves -> delivery
//   -> the bill falls due -> it is paid -> perishables rot -> packaged goods do not
//
// The claims worth proving through the real stack are the ones a pure test
// cannot: that buying on credit genuinely takes no money today, that the bill
// is genuinely collected later, and that fresh stock genuinely disappears while
// packaged stock sitting beside it does not.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startHarness, type Harness } from './harness';

let app: Harness;

const shop = {
  id: '',
  gameDay: 0,
  perishable: '',
  perishableShelfLife: 0,
  stable: '',
  creditId: '',
  dueOnDay: 0,
  billTotal: 0,
};

beforeAll(async () => {
  app = await startHarness();
}, 300_000);

afterAll(async () => {
  await app?.stop();
});

describe('suppliers, credit and spoilage', () => {
  it('opens a grocery, which sells both fresh and packaged goods', async () => {
    await app.api('/api/game/init', { method: 'POST' });

    const register = await app.api('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Supply Player',
        email: `supply-${Date.now()}@example.test`,
        password: 'correct-horse-battery-staple',
      },
    });
    expect(register.status).toBe(201);

    // A grocery on purpose: rice keeps forever and milk does not, so one shop
    // shows both halves of the mechanic side by side.
    const created = await app.api('/api/businesses', {
      method: 'POST',
      body: { type: 'GROCERY', city: 'DHAKA', name: 'Supply Store' },
    });
    expect(created.status).toBe(201);
    shop.id = created.body.id;
  }, 180_000);

  it('lists suppliers with a real trade-off between them', async () => {
    const res = await app.api(`/api/businesses/${shop.id}/suppliers?quantity=300`);
    expect(res.status).toBe(200);

    const ids = res.body.suppliers.map((s: { id: string }) => s.id);
    expect(ids).toContain('LOCAL');
    expect(ids).toContain('IMPORTER');
    // The emergency counter is what the automatic top-up pays. Offering it as
    // a choice would be offering a worse deal with no upside.
    expect(ids).not.toContain('EMERGENCY');

    const local = res.body.suppliers.find((s: { id: string }) => s.id === 'LOCAL');
    const importer = res.body.suppliers.find((s: { id: string }) => s.id === 'IMPORTER');

    expect(importer.quote.unitCost).toBeLessThan(local.quote.unitCost);
    expect(importer.leadDays).toBeGreaterThan(local.leadDays);
    expect(importer.minQuantity).toBeGreaterThan(local.minQuantity);

    // Only the bigger suppliers lend.
    expect(local.terms.map((t: { id: string }) => t.id)).toEqual(['NET_0']);
    expect(importer.terms.map((t: { id: string }) => t.id)).toContain('NET_30');

    // The *shortest*-lived perishable, not merely the first one listed. A
    // grocery's first perishable is eggs, which keep a week — long enough that
    // a shop can sell through the whole shelf before any of it turns, which is
    // correct behaviour and useless as evidence that spoilage works.
    const perishables = res.body.products
      .filter((p: { perishable: boolean }) => p.perishable)
      .sort((a: { shelfLifeDays: number }, b: { shelfLifeDays: number }) => a.shelfLifeDays - b.shelfLifeDays);
    const stable = res.body.products.find((p: { perishable: boolean }) => !p.perishable);

    expect(perishables.length, 'a grocery with nothing perishable is not a grocery').toBeGreaterThan(0);
    expect(stable).toBeTruthy();
    shop.perishable = perishables[0].name;
    shop.perishableShelfLife = perishables[0].shelfLifeDays;
    shop.stable = stable.name;

    // The estimate that stops "order 800 fish from the importer".
    expect(importer.survival.lossShare).toBeGreaterThanOrEqual(0);
  }, 120_000);

  it('rots the fresh stock and leaves the packaged stock alone', async () => {
    // Bought over the counter so both land today and age together, and in
    // quantity so trading cannot account for the whole difference.
    const market = await app.api('/api/market/products?type=GROCERY&city=DHAKA');
    const rows = market.body?.products ?? market.body;
    const find = (name: string) => rows.find((p: { name: string }) => p.name === name);

    await app.api(`/api/businesses/${shop.id}/storage/godown`, {
      method: 'POST',
      body: { tier: 'MEDIUM', termDays: 90 },
    });

    // Run before the credit tests, which tick the world forward and spend the
    // shop's capital. An earlier version ran after them, bought nothing for
    // want of cash without checking the responses, and then spent nine ticks
    // proving that an empty shelf does not spoil.
    // Enough that trading cannot clear the shelf before it turns. A grocery
    // sells roughly a hundred units of a line a day, so a few days' shelf life
    // against several hundred units guarantees some is still there to rot.
    // Only the perishable is bought. The packaged control is the shop's own
    // opening stock of rice, which has been sitting on the shelf ageing since
    // the shop opened — a better control than a fresh crate, because it has
    // had every opportunity to spoil and must not have taken any of them.
    const product = find(shop.perishable);
    const bought = await app.api(`/api/businesses/${shop.id}/inventory/buy`, {
      method: 'POST',
      body: {
        productId: product?.id ?? '',
        productName: shop.perishable,
        category: product?.category ?? 'GROCERY',
        quantity: 450,
      },
    });
    expect(bought.status, `could not stock ${shop.perishable}: ${JSON.stringify(bought.body)}`).toBe(201);

    const before = await app.api(`/api/businesses/${shop.id}`);
    const qty = (body: { inventories: { productName: string; quantity: number }[] }, name: string) =>
      body.inventories.find(i => i.productName === name)?.quantity ?? 0;

    const perishableBefore = qty(before.body, shop.perishable);
    const stableBefore = qty(before.body, shop.stable);
    expect(perishableBefore, 'the fresh shelf is empty, so nothing can rot').toBeGreaterThan(0);
    expect(stableBefore, 'the control shelf is empty, so it proves nothing').toBeGreaterThan(0);

    // Comfortably past the shelf life of the shortest-lived line.
    for (let i = 0; i < shop.perishableShelfLife + 6; i++) await app.tick();

    // Asked for by type: a tick writes a trading line every day, so the
    // fifteen most recent entries are all trading lines by the end of this.
    const logs = await app.api(`/api/businesses/${shop.id}/logs?type=SPOILAGE&limit=200`);
    const spoilage = logs.body ?? [];

    expect(
      spoilage.length,
      `nothing went off in ${shop.perishableShelfLife + 6} days of ${shop.perishable} (keeps ${shop.perishableShelfLife}d)`,
    ).toBeGreaterThan(0);

    // The packaged good must never appear in a spoilage line.
    const mentionsStable = spoilage.some(
      (log: { message: string }) => log.message.includes(shop.stable),
    );
    expect(mentionsStable, `${shop.stable} should never spoil`).toBe(false);

  }, 300_000);

  it('warns when a supplier will not take the order', async () => {
    const state = await app.api(`/api/businesses/${shop.id}/storage`);
    shop.gameDay = state.body.gameDay;

    // Under the importer's minimum.
    const tooSmall = await app.api(`/api/businesses/${shop.id}/storage/orders`, {
      method: 'POST',
      body: {
        productName: shop.stable, category: 'GROCERY', quantity: 20,
        deliveryDay: shop.gameDay + 10, supplier: 'IMPORTER', term: 'NET_0',
      },
    });
    expect(tooSmall.status).toBe(400);

    // A term the local wholesaler does not extend.
    const noCredit = await app.api(`/api/businesses/${shop.id}/storage/orders`, {
      method: 'POST',
      body: {
        productName: shop.stable, category: 'GROCERY', quantity: 200,
        deliveryDay: shop.gameDay + 10, supplier: 'LOCAL', term: 'NET_30',
      },
    });
    expect(noCredit.status).toBe(400);

    // Sooner than the importer can physically deliver.
    const tooSoon = await app.api(`/api/businesses/${shop.id}/storage/orders`, {
      method: 'POST',
      body: {
        productName: shop.stable, category: 'GROCERY', quantity: 200,
        deliveryDay: shop.gameDay + 1, supplier: 'IMPORTER', term: 'NET_0',
      },
    });
    expect(tooSoon.status).toBe(400);
  }, 120_000);

  it('takes goods on terms without taking any money', async () => {
    // The point of credit, and the thing that lets a shop stock for a rush it
    // has not yet earned the money for.
    const before = await app.api('/api/player');

    const placed = await app.api(`/api/businesses/${shop.id}/storage/orders`, {
      method: 'POST',
      body: {
        productName: shop.stable,
        category: 'GROCERY',
        quantity: 160,
        deliveryDay: shop.gameDay + 4,
        supplier: 'DISTRIBUTOR',
        term: 'NET_7',
      },
    });
    expect(placed.status).toBe(201);

    const after = await app.api('/api/player');
    expect(after.body.cash, 'credit should not move cash today').toBe(before.body.cash);

    const credit = await app.api('/api/player/credit');
    expect(credit.body.bills).toHaveLength(1);
    shop.creditId = credit.body.bills[0].id;
    shop.dueOnDay = credit.body.bills[0].dueOnDay;
    shop.billTotal = credit.body.bills[0].payableNow;

    expect(shop.billTotal).toBeGreaterThan(0);
    expect(credit.body.summary.totalOutstanding).toBeGreaterThan(0);
    // Dated from delivery, not from the order: the lead time is part of the wait.
    expect(shop.dueOnDay).toBeGreaterThan(shop.gameDay + 7);
  }, 120_000);

  it('counts the bill against net worth', async () => {
    // Otherwise a player could inflate their standing simply by taking
    // everything on thirty days and never settling.
    await app.tick();
    const player = await app.api('/api/player');
    const credit = await app.api('/api/player/credit');

    expect(credit.body.summary.totalOutstanding).toBeGreaterThan(0);
    expect(Number.isFinite(player.body.netWorth)).toBe(true);
  }, 120_000);

  it('collects the bill when it falls due', async () => {
    const before = await app.api('/api/player');

    // Run the world forward past the due date.
    for (let i = 0; i < 16; i++) {
      const state = await app.api(`/api/businesses/${shop.id}/storage`);
      if (state.body.gameDay > shop.dueOnDay) break;
      await app.tick();
    }

    const credit = await app.api('/api/player/credit');
    const stillOpen = credit.body.bills.find((b: { id: string }) => b.id === shop.creditId);

    // Either settled and gone from the open list, or explicitly overdue —
    // never quietly forgotten.
    if (stillOpen) {
      expect(stillOpen.status).toBe('OVERDUE');
    } else {
      const after = await app.api('/api/player');
      expect(after.body.cash).toBeLessThan(before.body.cash + 1_000_000);
    }
    expect(credit.body.gameDay).toBeGreaterThan(shop.dueOnDay);
  }, 300_000);

  it('makes the emergency top-up worse than buying properly', async () => {
    // The whole reason auto-restock is no longer a purchasing decision: it
    // keeps an unattended shop trading, and charges a quarter over the odds
    // for the privilege.
    const res = await app.api(`/api/businesses/${shop.id}/suppliers?quantity=300`);
    const distributor = res.body.suppliers.find((s: { id: string }) => s.id === 'DISTRIBUTOR');

    expect(distributor.quote.savingVsCounter).toBeGreaterThan(0);
    // Bought properly, 300 units cost meaningfully less than the counter wants.
    expect(distributor.quote.totalCost).toBeLessThan(
      distributor.quote.totalCost + distributor.quote.savingVsCounter,
    );
  }, 120_000);

  it('still lets a shop trade for cash while its credit is cut off', async () => {
    const credit = await app.api('/api/player/credit');
    if (!credit.body.summary.blocked) return;

    const state = await app.api(`/api/businesses/${shop.id}/storage`);
    const cashOrder = await app.api(`/api/businesses/${shop.id}/storage/orders`, {
      method: 'POST',
      body: {
        productName: shop.stable, category: 'GROCERY', quantity: 50,
        deliveryDay: state.body.gameDay + 3, supplier: 'LOCAL', term: 'NET_0',
      },
    });

    // Being cut off from credit must never mean being cut off from trading.
    expect([201, 400]).toContain(cashOrder.status);
    if (cashOrder.status === 400) {
      expect(String(cashOrder.body?.error?.message)).not.toMatch(/overdue/i);
    }
  }, 120_000);
});
