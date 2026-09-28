// ============================================
// One product, one shelf
// ============================================
//
// `POST /api/businesses/[id]/inventory/buy` used to merge stock on `productId`.
// That column is '' on shelves a shop opened with before it was fixed, '' on
// rows the AI writes, and an *order* id on pre-order deliveries — so the lookup
// missed and a second shelf appeared for a product that already had one. In the
// Inventory tab that reads as the same product listed twice, each half holding
// its own stock and its own price; in the tick, each half draws demand
// separately.
//
// The route now goes through `addStockToShelf`, which matches on the product
// name and folds any duplicates it finds back into one row.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addStockToShelf, collapseDuplicateShelves } from '@/lib/game/supply/supply-service';

interface Row {
  id: string;
  businessId: string;
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  purchasePrice: number;
  sellPrice: number;
  averageAgeDays: number;
  createdAt: Date;
}

/**
 * The slice of the Prisma client `addStockToShelf` touches, backed by an array.
 * Enough to assert on how many shelves survive and what they hold, without a
 * database.
 */
function fakeTx(rows: Row[]) {
  const deleted: string[] = [];
  const tx = {
    inventory: {
      findMany: vi.fn(async ({ where }: any) =>
        rows
          .filter(
            r =>
              r.businessId === where.businessId &&
              (where.productName === undefined || r.productName === where.productName),
          )
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
      ),
      update: vi.fn(async ({ where, data }: any) => {
        const row = rows.find(r => r.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
      create: vi.fn(async ({ data }: any) => {
        const row: Row = {
          id: `row-${rows.length + 1}`,
          sellPrice: 0,
          averageAgeDays: 0,
          createdAt: new Date(),
          ...data,
        };
        rows.push(row);
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        for (const id of where.id.in) {
          const idx = rows.findIndex(r => r.id === id);
          if (idx >= 0) {
            deleted.push(id);
            rows.splice(idx, 1);
          }
        }
        return { count: where.id.in.length };
      }),
    },
  };
  return { tx: tx as any, rows, deleted };
}

const shelf = (over: Partial<Row> = {}): Row => ({
  id: 'row-1',
  businessId: 'biz-1',
  productId: '',
  productName: 'Tea (Cha)',
  category: 'TEA_STALL',
  quantity: 100,
  purchasePrice: 8,
  sellPrice: 13,
  averageAgeDays: 0,
  createdAt: new Date('2026-01-01'),
  ...over,
});

const buy = (tx: any, over: Record<string, unknown> = {}) =>
  addStockToShelf({
    tx,
    businessId: 'biz-1',
    businessType: 'TEA_STALL',
    productName: 'Tea (Cha)',
    category: 'TEA_STALL',
    quantity: 50,
    unitCost: 10,
    incomingAgeDays: 0,
    ...over,
  });

let harness: ReturnType<typeof fakeTx>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buying into an empty shop', () => {
  it('creates one shelf', async () => {
    harness = fakeTx([]);
    await buy(harness.tx, { productIdFallback: 'prod-tea' });

    expect(harness.rows).toHaveLength(1);
    expect(harness.rows[0]).toMatchObject({ productName: 'Tea (Cha)', quantity: 50 });
  });

  it('records the real product id when one is supplied', async () => {
    harness = fakeTx([]);
    await buy(harness.tx, { productIdFallback: 'prod-tea' });
    expect(harness.rows[0].productId).toBe('prod-tea');
  });
});

describe('buying into a shop that already stocks the product', () => {
  it('adds to the existing shelf rather than making a second one', async () => {
    harness = fakeTx([shelf()]);
    await buy(harness.tx, { productIdFallback: 'prod-tea' });

    expect(harness.rows).toHaveLength(1);
    expect(harness.rows[0].quantity).toBe(150);
  });

  it('merges even though the existing shelf has no productId', async () => {
    // This is the exact shape of the bug: the shelf a shop opened with carries
    // productId '', the buy request carries the real one.
    harness = fakeTx([shelf({ productId: '' })]);
    await buy(harness.tx, { productIdFallback: 'prod-tea' });

    expect(harness.rows).toHaveLength(1);
    expect(harness.tx.inventory.create).not.toHaveBeenCalled();
  });

  it('merges even though the existing shelf carries an unrelated id', async () => {
    // A pre-order delivery writes the *order* id into productId.
    harness = fakeTx([shelf({ productId: 'preorder-abc' })]);
    await buy(harness.tx, { productIdFallback: 'prod-tea' });

    expect(harness.rows).toHaveLength(1);
    expect(harness.rows[0].quantity).toBe(150);
  });

  it('backfills a missing product id onto the surviving shelf', async () => {
    harness = fakeTx([shelf({ productId: '' })]);
    await buy(harness.tx, { productIdFallback: 'prod-tea' });
    expect(harness.rows[0].productId).toBe('prod-tea');
  });

  it('does not overwrite a product id the shelf already has', async () => {
    harness = fakeTx([shelf({ productId: 'prod-original' })]);
    await buy(harness.tx, { productIdFallback: 'prod-other' });
    expect(harness.rows[0].productId).toBe('prod-original');
  });

  it('weights the cost basis across old and new stock', async () => {
    harness = fakeTx([shelf({ quantity: 100, purchasePrice: 8 })]);
    await buy(harness.tx, { quantity: 100, unitCost: 12 });

    // (100x8 + 100x12) / 200 = 10
    expect(harness.rows[0].purchasePrice).toBe(10);
  });

  it('leaves the shelf price alone — that is the owner’s to set', async () => {
    harness = fakeTx([shelf({ sellPrice: 25 })]);
    await buy(harness.tx);
    expect(harness.rows[0].sellPrice).toBe(25);
  });
});

describe('repairing a shop that already has duplicates', () => {
  it('folds the strays into one shelf', async () => {
    harness = fakeTx([
      shelf({ id: 'row-1', quantity: 100, createdAt: new Date('2026-01-01') }),
      shelf({ id: 'row-2', quantity: 40, createdAt: new Date('2026-01-02') }),
      shelf({ id: 'row-3', quantity: 10, createdAt: new Date('2026-01-03') }),
    ]);

    await buy(harness.tx, { quantity: 50, unitCost: 8 });

    expect(harness.rows).toHaveLength(1);
    // Nothing is lost in the repair: 100 + 40 + 10 held, plus 50 bought.
    expect(harness.rows[0].quantity).toBe(200);
  });

  it('keeps the oldest shelf, so the row the player has been pricing survives', async () => {
    harness = fakeTx([
      shelf({ id: 'row-2', quantity: 40, sellPrice: 99, createdAt: new Date('2026-01-02') }),
      shelf({ id: 'row-1', quantity: 100, sellPrice: 13, createdAt: new Date('2026-01-01') }),
    ]);

    await buy(harness.tx);

    expect(harness.rows).toHaveLength(1);
    expect(harness.rows[0].id).toBe('row-1');
    expect(harness.deleted).toEqual(['row-2']);
  });

  it('weights the cost basis across every duplicate, not just the first', async () => {
    harness = fakeTx([
      shelf({ id: 'row-1', quantity: 100, purchasePrice: 6, createdAt: new Date('2026-01-01') }),
      shelf({ id: 'row-2', quantity: 100, purchasePrice: 14, createdAt: new Date('2026-01-02') }),
    ]);

    await buy(harness.tx, { quantity: 200, unitCost: 10 });

    // (100x6 + 100x14 + 200x10) / 400 = 10
    expect(harness.rows[0].purchasePrice).toBe(10);
  });

  it('weights age across every duplicate', async () => {
    harness = fakeTx([
      shelf({ id: 'row-1', quantity: 100, averageAgeDays: 4, createdAt: new Date('2026-01-01') }),
      shelf({ id: 'row-2', quantity: 100, averageAgeDays: 0, createdAt: new Date('2026-01-02') }),
    ]);

    // 200 units averaging 2 days, plus 200 fresh -> 1 day.
    await buy(harness.tx, { quantity: 200, unitCost: 10, incomingAgeDays: 0 });
    expect(harness.rows[0].averageAgeDays).toBeCloseTo(1, 5);
  });

  it('only touches the product being bought', async () => {
    harness = fakeTx([
      shelf({ id: 'row-1', productName: 'Tea (Cha)', quantity: 100 }),
      shelf({ id: 'row-2', productName: 'Biscuits', quantity: 60 }),
      shelf({ id: 'row-3', productName: 'Biscuits', quantity: 20 }),
    ]);

    await buy(harness.tx, { quantity: 50 });

    // The Biscuits duplicates are left for their own next purchase to fold in.
    expect(harness.rows).toHaveLength(3);
    expect(harness.rows.find(r => r.id === 'row-1')!.quantity).toBe(150);
  });
});

describe('guards', () => {
  it('ignores a zero or negative quantity', async () => {
    harness = fakeTx([shelf()]);
    await buy(harness.tx, { quantity: 0 });
    await buy(harness.tx, { quantity: -5 });

    expect(harness.rows[0].quantity).toBe(100);
    expect(harness.tx.inventory.update).not.toHaveBeenCalled();
    expect(harness.tx.inventory.create).not.toHaveBeenCalled();
  });

  it('handles duplicates that are all empty', async () => {
    harness = fakeTx([
      shelf({ id: 'row-1', quantity: 0, createdAt: new Date('2026-01-01') }),
      shelf({ id: 'row-2', quantity: 0, createdAt: new Date('2026-01-02') }),
    ]);

    await buy(harness.tx, { quantity: 50, unitCost: 10 });

    expect(harness.rows).toHaveLength(1);
    expect(harness.rows[0].quantity).toBe(50);
    expect(harness.rows[0].purchasePrice).toBe(10);
    expect(Number.isFinite(harness.rows[0].averageAgeDays)).toBe(true);
  });
});

// ============================================
// Repairing a whole shop at once
// ============================================
//
// The buy path repairs the one product being bought. "Restock all" touches
// every product, so it collapses the whole shop first — otherwise a duplicated
// shelf would be topped up twice, once per row.

describe('collapseDuplicateShelves', () => {
  it('leaves a healthy shop untouched', async () => {
    harness = fakeTx([
      shelf({ id: 'row-1', productName: 'Tea (Cha)' }),
      shelf({ id: 'row-2', productName: 'Biscuits' }),
    ]);

    const removed = await collapseDuplicateShelves(harness.tx, 'biz-1');

    expect(removed).toBe(0);
    expect(harness.rows).toHaveLength(2);
    expect(harness.tx.inventory.update).not.toHaveBeenCalled();
  });

  it('collapses every duplicated product in one pass', async () => {
    harness = fakeTx([
      shelf({ id: 'row-1', productName: 'Tea (Cha)', quantity: 100, createdAt: new Date('2026-01-01') }),
      shelf({ id: 'row-2', productName: 'Tea (Cha)', quantity: 40, createdAt: new Date('2026-01-02') }),
      shelf({ id: 'row-3', productName: 'Biscuits', quantity: 60, createdAt: new Date('2026-01-01') }),
      shelf({ id: 'row-4', productName: 'Biscuits', quantity: 20, createdAt: new Date('2026-01-02') }),
      shelf({ id: 'row-5', productName: 'Samosa', quantity: 10, createdAt: new Date('2026-01-01') }),
    ]);

    const removed = await collapseDuplicateShelves(harness.tx, 'biz-1');

    expect(removed).toBe(2);
    expect(harness.rows).toHaveLength(3);
    expect(harness.rows.find(r => r.productName === 'Tea (Cha)')!.quantity).toBe(140);
    expect(harness.rows.find(r => r.productName === 'Biscuits')!.quantity).toBe(80);
    expect(harness.rows.find(r => r.productName === 'Samosa')!.quantity).toBe(10);
  });

  it('keeps the oldest row of each product', async () => {
    harness = fakeTx([
      shelf({ id: 'newer', quantity: 40, createdAt: new Date('2026-01-02') }),
      shelf({ id: 'older', quantity: 100, createdAt: new Date('2026-01-01') }),
    ]);

    await collapseDuplicateShelves(harness.tx, 'biz-1');

    expect(harness.rows).toHaveLength(1);
    expect(harness.rows[0].id).toBe('older');
  });

  it('weights cost and age across the rows it merges', async () => {
    harness = fakeTx([
      shelf({ id: 'row-1', quantity: 100, purchasePrice: 6, averageAgeDays: 4, createdAt: new Date('2026-01-01') }),
      shelf({ id: 'row-2', quantity: 100, purchasePrice: 14, averageAgeDays: 0, createdAt: new Date('2026-01-02') }),
    ]);

    await collapseDuplicateShelves(harness.tx, 'biz-1');

    expect(harness.rows[0].purchasePrice).toBe(10);
    expect(harness.rows[0].averageAgeDays).toBeCloseTo(2, 5);
  });

  it('salvages a real product id from whichever duplicate had one', async () => {
    harness = fakeTx([
      shelf({ id: 'row-1', productId: '', createdAt: new Date('2026-01-01') }),
      shelf({ id: 'row-2', productId: 'prod-tea', createdAt: new Date('2026-01-02') }),
    ]);

    await collapseDuplicateShelves(harness.tx, 'biz-1');
    expect(harness.rows[0].productId).toBe('prod-tea');
  });

  it('loses no stock', async () => {
    const rows = [
      shelf({ id: 'row-1', quantity: 37, createdAt: new Date('2026-01-01') }),
      shelf({ id: 'row-2', quantity: 11, createdAt: new Date('2026-01-02') }),
      shelf({ id: 'row-3', quantity: 5, createdAt: new Date('2026-01-03') }),
    ];
    const before = rows.reduce((sum, r) => sum + r.quantity, 0);
    harness = fakeTx(rows);

    await collapseDuplicateShelves(harness.tx, 'biz-1');

    expect(harness.rows.reduce((sum, r) => sum + r.quantity, 0)).toBe(before);
  });

  it('copes with an all-empty duplicate pair without producing NaN', async () => {
    harness = fakeTx([
      shelf({ id: 'row-1', quantity: 0, purchasePrice: 8, createdAt: new Date('2026-01-01') }),
      shelf({ id: 'row-2', quantity: 0, purchasePrice: 9, createdAt: new Date('2026-01-02') }),
    ]);

    await collapseDuplicateShelves(harness.tx, 'biz-1');

    expect(harness.rows).toHaveLength(1);
    expect(Number.isFinite(harness.rows[0].purchasePrice)).toBe(true);
    expect(Number.isFinite(harness.rows[0].averageAgeDays)).toBe(true);
  });
});
