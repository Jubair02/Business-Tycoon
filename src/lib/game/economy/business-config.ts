// ============================================
// Bangladesh Business Tycoon - Business Economy Config
// Phase 1: Centralized business balance configuration
//
// Each business type has its own economic identity:
// - Tea Stall: Low capital, high accessibility, stable
// - Grocery: Moderate capital, stable volume, reliable
// - Clothing: Higher capital, seasonal, higher margins
// - Restaurant: High revenue potential, high operating cost
// - Mobile: High investment, high risk, high reward
// ============================================

import type { BusinessEconomyConfig, RiskLevel } from './types';

export const BUSINESS_ECONOMY_CONFIG: Record<string, BusinessEconomyConfig> = {
  TEA_STALL: {
    businessTypeId: 'TEA_STALL',
    targetMargin: 0.35,        // 35% target margin
    priceSensitivity: 1.2,     // Customers very price-sensitive (tea is cheap, alternatives easy)
    volatility: 0.08,          // Low volatility (±8%)
    riskLevel: 'LOW',
    growthCeiling: 3.0,        // Limited growth - a tea stall can only grow so much
    stockTargetRatio: 0.5,     // Need 50% stock for full satisfaction
    employeeBonusPer: 0.06,    // 6% per employee
    utilityMultiplier: 0.5,    // Low utilities (small operation)
    rentScalePerLevel: 1.12,   // Rent scales 12% per level
  },
  GROCERY: {
    businessTypeId: 'GROCERY',
    targetMargin: 0.22,        // 22% target margin (grocery = volume, not margin)
    priceSensitivity: 0.9,     // Moderate price sensitivity
    volatility: 0.06,          // Low volatility (essentials are stable)
    riskLevel: 'MEDIUM',
    growthCeiling: 5.0,        // Moderate growth potential
    stockTargetRatio: 0.6,     // Need 60% stock (variety matters)
    employeeBonusPer: 0.07,    // 7% per employee
    utilityMultiplier: 0.8,    // Moderate utilities (refrigeration, lighting)
    rentScalePerLevel: 1.13,   // Rent scales 13% per level
  },
  CLOTHING: {
    businessTypeId: 'CLOTHING',
    targetMargin: 0.38,        // 38% target margin (fashion has higher margins)
    priceSensitivity: 1.1,     // High price sensitivity (customers shop around)
    volatility: 0.12,          // Moderate volatility (seasonal demand swings)
    riskLevel: 'MEDIUM',
    growthCeiling: 6.0,        // Good growth potential
    stockTargetRatio: 0.5,     // Need 50% stock
    employeeBonusPer: 0.08,    // 8% per employee (sales staff important)
    utilityMultiplier: 0.7,    // Moderate utilities (display lighting, AC)
    rentScalePerLevel: 1.14,   // Rent scales 14% per level
  },
  MOBILE: {
    businessTypeId: 'MOBILE',
    targetMargin: 0.25,        // 25% target margin (electronics has decent margins but high costs)
    priceSensitivity: 1.4,     // Very high price sensitivity (customers compare prices carefully)
    volatility: 0.18,          // High volatility (tech market fluctuations)
    riskLevel: 'HIGH',
    growthCeiling: 8.0,        // High growth potential
    stockTargetRatio: 0.4,     // Need 40% stock (fewer items, higher value)
    employeeBonusPer: 0.09,    // 9% per employee (technical expertise matters)
    utilityMultiplier: 1.2,    // High utilities (security, display, AC)
    rentScalePerLevel: 1.15,   // Rent scales 15% per level
  },
  RESTAURANT: {
    businessTypeId: 'RESTAURANT',
    targetMargin: 0.30,        // 30% target margin
    priceSensitivity: 1.0,     // Moderate-high price sensitivity
    volatility: 0.10,          // Moderate volatility
    riskLevel: 'MEDIUM',
    growthCeiling: 6.0,        // Good growth potential
    stockTargetRatio: 0.55,    // Need 55% stock (freshness matters)
    employeeBonusPer: 0.08,    // 8% per employee (service quality critical)
    utilityMultiplier: 1.0,    // High utilities (cooking, refrigeration, gas)
    rentScalePerLevel: 1.13,   // Rent scales 13% per level
  },
};

export function getBusinessEconomyConfig(businessTypeId: string): BusinessEconomyConfig {
  return BUSINESS_ECONOMY_CONFIG[businessTypeId] ?? BUSINESS_ECONOMY_CONFIG.TEA_STALL;
}
