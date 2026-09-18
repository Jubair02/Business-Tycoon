// ============================================
// Bangladesh Business Tycoon - Economy Engine
// Phase 1: Centralized export for all economy modules
// ============================================

export * from './types';
export * from './formulas';
export { BUSINESS_ECONOMY_CONFIG, getBusinessEconomyConfig } from './business-config';
export { PRODUCT_DEMAND_CONFIG, getProductDemandConfig } from './product-demand';
export { ECONOMY_CONFIG, HEALTH_THRESHOLDS, DEMAND_THRESHOLDS } from './economy-config';
export {
  COMPETITION_CONFIG,
  calculateCompetitionPressure,
  calculateShopAttractiveness,
  calculatePriceIndex,
} from './competition';

// Phase 3: Customer Experience
export * from './cx-config';
export * from './cx-formulas';

// `types` and `cx-config` both declare these names, which makes the two
// wildcard re-exports above ambiguous. Pick the canonical definition explicitly.
export type { CustomerSegmentId, LoyaltyTierId } from './types';
