// ============================================
// Bangladesh Business Tycoon - Expansion & Locations Config
// Phase 5: Business Expansion & Growth System
// ============================================

import type { AIPersonality } from '../ai/types';

// ---- Location Definitions ----

export interface Location {
  id: string;
  name: string;
  nameBn: string;
  cityId: string;
  description: string;
  /** Multiplier on base rent (e.g., 1.3 = 30% more expensive) */
  rentModifier: number;
  /** Multiplier on customer traffic */
  customerModifier: number;
  /** Modifier on competition intensity (higher = more competitive) */
  competitionModifier: number;
  /** Growth potential 0-1 (higher = more room for growth) */
  growthPotential: number;
  /** Operating cost modifier (utilities, maintenance) */
  operatingCostModifier: number;
  /** Icon/emoji */
  icon: string;
  /** Suitable business types (empty = all types suitable) */
  suitableTypes: string[];
  /** Unsuitable business types (penalty) */
  unsuitableTypes: string[];
}

/**
 * Locations within each city - granular areas with distinct characteristics.
 * Each provides meaningful differences in rent, customers, competition,
 * and growth potential that affect business performance.
 */
export const LOCATIONS: Location[] = [
  // ---- DHAKA ----
  {
    id: 'DHAKA_GULSHAN',
    name: 'Gulshan',
    nameBn: 'গুলশান',
    cityId: 'DHAKA',
    description: 'Premium diplomatic zone. High-spending customers, expensive rent.',
    rentModifier: 1.8,
    customerModifier: 1.2,
    competitionModifier: 1.4,
    growthPotential: 0.4,
    operatingCostModifier: 1.3,
    icon: '🏢',
    suitableTypes: ['CLOTHING', 'MOBILE', 'RESTAURANT'],
    unsuitableTypes: ['TEA_STALL'],
  },
  {
    id: 'DHAKA_OLD_DHAKA',
    name: 'Old Dhaka',
    nameBn: 'পুরান ঢাকা',
    cityId: 'DHAKA',
    description: 'Traditional commercial hub. High foot traffic, lower costs.',
    rentModifier: 0.8,
    customerModifier: 1.5,
    competitionModifier: 1.6,
    growthPotential: 0.5,
    operatingCostModifier: 0.9,
    icon: '🏘️',
    suitableTypes: ['TEA_STALL', 'GROCERY', 'CLOTHING'],
    unsuitableTypes: ['MOBILE'],
  },
  {
    id: 'DHAKA_DHANMONDI',
    name: 'Dhanmondi',
    nameBn: 'ধানমন্ডি',
    cityId: 'DHAKA',
    description: 'Mid-range residential & commercial area. Balanced market.',
    rentModifier: 1.3,
    customerModifier: 1.3,
    competitionModifier: 1.2,
    growthPotential: 0.6,
    operatingCostModifier: 1.1,
    icon: '🏠',
    suitableTypes: ['RESTAURANT', 'GROCERY', 'CLOTHING'],
    unsuitableTypes: [],
  },
  {
    id: 'DHAKA_UTTARA',
    name: 'Uttara',
    nameBn: 'উত্তরা',
    cityId: 'DHAKA',
    description: 'Growing residential area. Lower competition, good growth potential.',
    rentModifier: 1.0,
    customerModifier: 1.0,
    competitionModifier: 0.7,
    growthPotential: 0.8,
    operatingCostModifier: 0.9,
    icon: '🏡',
    suitableTypes: ['GROCERY', 'RESTAURANT', 'TEA_STALL'],
    unsuitableTypes: [],
  },
  {
    id: 'DHAKA_MOHAKHALI',
    name: 'Mohakhali',
    nameBn: 'মহাখালী',
    cityId: 'DHAKA',
    description: 'Mixed commercial area near universities. Young customers.',
    rentModifier: 1.1,
    customerModifier: 1.2,
    competitionModifier: 1.0,
    growthPotential: 0.7,
    operatingCostModifier: 1.0,
    icon: '🎓',
    suitableTypes: ['TEA_STALL', 'RESTAURANT', 'GROCERY'],
    unsuitableTypes: [],
  },

  // ---- CHITTAGONG ----
  {
    id: 'CTG_AGRABAD',
    name: 'Agrabad',
    nameBn: 'আগ্রাবাদ',
    cityId: 'CHITTAGONG',
    description: 'Commercial district. Strong trade and business activity.',
    rentModifier: 1.2,
    customerModifier: 1.3,
    competitionModifier: 1.3,
    growthPotential: 0.5,
    operatingCostModifier: 1.1,
    icon: '🏪',
    suitableTypes: ['GROCERY', 'CLOTHING', 'MOBILE'],
    unsuitableTypes: [],
  },
  {
    id: 'CTG_GEC',
    name: 'GEC Circle',
    nameBn: 'জিইসি সার্কেল',
    cityId: 'CHITTAGONG',
    description: 'Premium area. Higher spending, higher costs.',
    rentModifier: 1.5,
    customerModifier: 1.0,
    competitionModifier: 1.1,
    growthPotential: 0.4,
    operatingCostModifier: 1.2,
    icon: '🌆',
    suitableTypes: ['CLOTHING', 'RESTAURANT', 'MOBILE'],
    unsuitableTypes: ['TEA_STALL'],
  },
  {
    id: 'CTG_JAMALKHAN',
    name: 'Jamalkhan',
    nameBn: 'জামালখান',
    cityId: 'CHITTAGONG',
    description: 'Traditional market area. High foot traffic, affordable.',
    rentModifier: 0.8,
    customerModifier: 1.2,
    competitionModifier: 1.4,
    growthPotential: 0.5,
    operatingCostModifier: 0.8,
    icon: '🛒',
    suitableTypes: ['TEA_STALL', 'GROCERY', 'CLOTHING'],
    unsuitableTypes: [],
  },

  // ---- SYLHET ----
  {
    id: 'SYL_BONDAR',
    name: 'Bondar Bazar',
    nameBn: 'বন্দর বাজার',
    cityId: 'SYLHET',
    description: 'Traditional market. Tourist-friendly, authentic experience.',
    rentModifier: 0.7,
    customerModifier: 1.2,
    competitionModifier: 1.0,
    growthPotential: 0.6,
    operatingCostModifier: 0.8,
    icon: '🛍️',
    suitableTypes: ['TEA_STALL', 'RESTAURANT', 'GROCERY'],
    unsuitableTypes: ['MOBILE'],
  },
  {
    id: 'SYL_SUBID',
    name: 'Subid Bazar',
    nameBn: 'সুবিদ বাজার',
    cityId: 'SYLHET',
    description: 'Growing commercial area. Good for new businesses.',
    rentModifier: 0.9,
    customerModifier: 1.0,
    competitionModifier: 0.7,
    growthPotential: 0.8,
    operatingCostModifier: 0.9,
    icon: '🌱',
    suitableTypes: ['GROCERY', 'CLOTHING', 'RESTAURANT'],
    unsuitableTypes: [],
  },

  // ---- RAJSHAHI ----
  {
    id: 'RAJ_SHAHEB',
    name: 'Shaheb Bazar',
    nameBn: 'সাহেব বাজার',
    cityId: 'RAJSHAHI',
    description: 'Main commercial area. Low costs, steady customers.',
    rentModifier: 0.6,
    customerModifier: 1.0,
    competitionModifier: 0.8,
    growthPotential: 0.6,
    operatingCostModifier: 0.7,
    icon: '🏪',
    suitableTypes: ['TEA_STALL', 'GROCERY', 'CLOTHING'],
    unsuitableTypes: [],
  },
  {
    id: 'RAJ_BOALIA',
    name: 'Boalia',
    nameBn: 'বোয়ালিয়া',
    cityId: 'RAJSHAHI',
    description: 'Residential area. Lower traffic but very affordable.',
    rentModifier: 0.5,
    customerModifier: 0.8,
    competitionModifier: 0.5,
    growthPotential: 0.7,
    operatingCostModifier: 0.6,
    icon: '🏘️',
    suitableTypes: ['TEA_STALL', 'GROCERY'],
    unsuitableTypes: ['MOBILE'],
  },

  // ---- KHULNA ----
  {
    id: 'KHL_SONADANGA',
    name: 'Sonadanga',
    nameBn: 'সোনাডাঙ্গা',
    cityId: 'KHULNA',
    description: 'Main commercial area. Industrial customer base.',
    rentModifier: 0.7,
    customerModifier: 1.0,
    competitionModifier: 0.8,
    growthPotential: 0.5,
    operatingCostModifier: 0.8,
    icon: '🏭',
    suitableTypes: ['GROCERY', 'TEA_STALL', 'CLOTHING'],
    unsuitableTypes: [],
  },
  {
    id: 'KHL_DAULATPUR',
    name: 'Daulatpur',
    nameBn: 'দৌলতপুর',
    cityId: 'KHULNA',
    description: 'Industrial area. Workers need daily essentials.',
    rentModifier: 0.5,
    customerModifier: 0.9,
    competitionModifier: 0.6,
    growthPotential: 0.6,
    operatingCostModifier: 0.7,
    icon: '⚙️',
    suitableTypes: ['TEA_STALL', 'GROCERY', 'RESTAURANT'],
    unsuitableTypes: ['MOBILE'],
  },
];

// ---- Expansion Configuration ----

export interface ExpansionConfig {
  /** Maximum businesses a player can own */
  maxBusinessesPerPlayer: number;
  /** Cooldown in game days between expansions */
  expansionCooldownDays: number;
  /** Base setup time in game days for a new business */
  baseSetupDays: number;
  /** Maximum setup days (even for expensive businesses) */
  maxSetupDays: number;
  /** Revenue multiplier during setup (fraction of normal) */
  setupRevenueMultiplier: number;
  /** Cost scaling factor: totalCost = baseCost × (1 + ownedCount × scaleFactor) */
  expansionCostScaleFactor: number;
  /** Minimum cash reserve required after expansion (fraction of netWorth) */
  minCashReserveRatio: number;
  /** Minimum player level required to open 2nd business */
  minLevelForSecondBusiness: number;
  /** Minimum player level required for each additional business beyond 2 */
  minLevelPerAdditionalBusiness: number;
  /** Minimum days a business must be profitable before expanding */
  minProfitDaysBeforeExpansion: number;
  /** Cash required per day of operation as safety margin */
  workingCapitalDays: number;
  /** Location unsuitability penalty (demand multiplier) */
  unsuitableLocationPenalty: number;
  /** Location suitability bonus (demand modifier) */
  suitableLocationBonus: number;
  /** Brand awareness transfer between businesses (fraction carried to new business) */
  brandAwarenessTransfer: number;
  /** Fraction of each product's max stock a new business opens with (and pays for) */
  startingStockRatio: number;
}

export const EXPANSION_CONFIG: ExpansionConfig = {
  maxBusinessesPerPlayer: 5,
  expansionCooldownDays: 7,
  baseSetupDays: 3,
  maxSetupDays: 10,
  setupRevenueMultiplier: 0.3,
  expansionCostScaleFactor: 0.4,
  minCashReserveRatio: 0.15,
  minLevelForSecondBusiness: 2,
  minLevelPerAdditionalBusiness: 1,
  minProfitDaysBeforeExpansion: 5,
  workingCapitalDays: 7,
  unsuitableLocationPenalty: 0.7,
  suitableLocationBonus: 1.15,
  brandAwarenessTransfer: 0.2,
  startingStockRatio: 0.4,
};

// ---- AI Expansion Configuration ----

export interface AIExpansionConfig {
  /** Per-personality expansion eagerness (multiplier on base expansionEagerness) */
  personalityExpansionEagerness: Record<AIPersonality, number>;
  /** Minimum cash reserve AI keeps after expansion (fraction of netWorth) */
  aiCashReserveAfterExpansion: Record<AIPersonality, number>;
  /** Minimum profit threshold before AI considers expansion */
  minDailyProfitForExpansion: number;
  /** Maximum businesses an AI can own */
  maxAIBusinesses: number;
}

export const AI_EXPANSION_CONFIG: AIExpansionConfig = {
  personalityExpansionEagerness: {
    CONSERVATIVE: 0.3,
    BALANCED: 0.6,
    AGGRESSIVE: 0.9,
    TRADER: 0.5,
    EXPANSIONIST: 1.0,
  },
  aiCashReserveAfterExpansion: {
    CONSERVATIVE: 0.4,
    BALANCED: 0.25,
    AGGRESSIVE: 0.1,
    TRADER: 0.2,
    EXPANSIONIST: 0.15,
  },
  minDailyProfitForExpansion: 5000,
  maxAIBusinesses: 4,
};

// ---- Helper Functions ----

/** Get all locations for a city */
export function getLocationsForCity(cityId: string): Location[] {
  return LOCATIONS.filter(l => l.cityId === cityId);
}

/** Get a specific location by ID */
export function getLocation(locationId: string): Location | undefined {
  return LOCATIONS.find(l => l.id === locationId);
}

/** Get a random location for a city (for AI use) */
export function getRandomLocationForCity(cityId: string): Location | undefined {
  const locations = getLocationsForCity(cityId);
  if (locations.length === 0) return undefined;
  return locations[Math.floor(Math.random() * locations.length)];
}

/** Check if a business type is suitable for a location */
export function isBusinessTypeSuitable(locationId: string, businessTypeId: string): 'suitable' | 'neutral' | 'unsuitable' {
  const location = getLocation(locationId);
  if (!location) return 'neutral';
  if (location.suitableTypes.includes(businessTypeId)) return 'suitable';
  if (location.unsuitableTypes.includes(businessTypeId)) return 'unsuitable';
  return 'neutral';
}
