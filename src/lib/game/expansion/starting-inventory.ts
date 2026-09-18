// ============================================
// Bangladesh Business Tycoon - Starting Inventory
// ============================================
//
// Opening a business stocks its shelves. That stock used to be handed over
// free: the create-business route wrote the rows after the payment transaction
// without charging for them, while `POST /inventory/sell` buys stock back at
// 70% of purchase price. Opening a shop therefore minted cash out of nothing,
// and the inventory also landed in net worth at full value.
//
// Stock is now priced like any other restock and paid for as part of the
// opening cost, which is what `seedAIPlayers` already did for the AI's initial
// businesses.

import { PRODUCTS } from '@/lib/game-data';
import { EXPANSION_CONFIG } from './expansion-config';

export interface StartingInventoryItem {
  productName: string;
  category: string;
  quantity: number;
  /** Unit cost — also the cost basis COGS and liquidation are computed from. */
  purchasePrice: number;
  /** Default shelf price; callers with their own pricing (the AI) may override. */
  sellPrice: number;
  /** quantity × purchasePrice */
  lineCost: number;
}

export interface StartingInventory {
  items: StartingInventoryItem[];
  totalCost: number;
}

/**
 * The stock a new business opens with, priced at wholesale.
 *
 * Returns an empty set for an unknown business type rather than throwing —
 * the callers validate the type first, and a bad id should not take down a
 * cost estimate.
 */
export function buildStartingInventory(businessTypeId: string): StartingInventory {
  const productDefs = PRODUCTS[businessTypeId] || [];

  const items = productDefs.map((prod) => {
    const quantity = Math.floor(prod.maxStock * EXPANSION_CONFIG.startingStockRatio);
    const purchasePrice = prod.basePrice;
    return {
      productName: prod.name,
      category: prod.category,
      quantity,
      purchasePrice,
      sellPrice: Math.round(prod.basePrice * (1 + prod.suggestedMarkup)),
      lineCost: Math.round(purchasePrice * quantity),
    };
  });

  return {
    items,
    totalCost: items.reduce((sum, item) => sum + item.lineCost, 0),
  };
}

/** Wholesale cost of a new business's opening stock. */
export function calculateStartingInventoryCost(businessTypeId: string): number {
  return buildStartingInventory(businessTypeId).totalCost;
}
