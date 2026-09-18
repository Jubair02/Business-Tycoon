// ============================================
// Bangladesh Business Tycoon - Expansion System (Barrel Export)
// Phase 5: Business Expansion & Growth System
// ============================================

export {
  LOCATIONS,
  EXPANSION_CONFIG,
  AI_EXPANSION_CONFIG,
  getLocationsForCity,
  getLocation,
  getRandomLocationForCity,
  isBusinessTypeSuitable,
} from './expansion-config';
export type { Location, ExpansionConfig, AIExpansionConfig } from './expansion-config';

export {
  calculateExpansionCost,
  calculateSetupDays,
  checkExpansionEligibility,
  calculateLocationDemandModifier,
  calculateLocationRentModifier,
  calculateLocationOperatingCostModifier,
  calculateSetupModifier,
  advanceSetupDay,
  calculatePortfolioSummary,
} from './expansion-formulas';
export type { ExpansionEligibility, PortfolioSummary } from './expansion-formulas';
export * from './starting-inventory';
