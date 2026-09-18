// ============================================
// Bangladesh Business Tycoon - Product Demand Config
// Phase 1: Per-product demand behavior
//
// Each product has its own demand characteristics:
// - Staples (Tea, Rice) have stable demand, low volatility
// - Seasonal items (Winter Jacket) have high event sensitivity
// - Premium items (Premium Smartphone) have low volume, high margins
// - Discretionary items (Snacks, Earphones) have higher price sensitivity
// ============================================

import type { ProductDemandConfig } from './types';

export const PRODUCT_DEMAND_CONFIG: Record<string, ProductDemandConfig> = {
  // ---- Tea Stall Products ----
  'Tea (Cha)': {
    productName: 'Tea (Cha)',
    baseDemand: 0.823,
    priceSensitivity: 1.0,     // Moderate — tea is cheap, small price changes matter
    volatility: 0.05,          // Very stable demand
    category: 'TEA_STALL',
    isStaple: true,
    seasonalCategories: ['WINTER_SEASON', 'UNIVERSITY_SEASON'],
  },
  'Biscuits': {
    productName: 'Biscuits',
    baseDemand: 0.493,
    priceSensitivity: 0.8,
    volatility: 0.06,
    category: 'TEA_STALL',
    isStaple: true,
    seasonalCategories: [],
  },
  'Singara': {
    productName: 'Singara',
    baseDemand: 0.576,
    priceSensitivity: 0.9,
    volatility: 0.08,
    category: 'TEA_STALL',
    isStaple: false,
    seasonalCategories: ['MONSOON'], // Popular rainy-day snack
  },
  'Samosa': {
    productName: 'Samosa',
    baseDemand: 0.411,
    priceSensitivity: 0.9,
    volatility: 0.08,
    category: 'TEA_STALL',
    isStaple: false,
    seasonalCategories: [],
  },
  'Cold Drinks': {
    productName: 'Cold Drinks',
    baseDemand: 0.658,
    priceSensitivity: 1.3,     // High — many alternatives, price-sensitive
    volatility: 0.15,          // Very volatile — heatwave makes or breaks this
    category: 'COLD_DRINKS',
    isStaple: false,
    seasonalCategories: ['HEATWAVE'],
  },

  // ---- Grocery Products ----
  'Rice (5kg)': {
    productName: 'Rice (5kg)',
    baseDemand: 0.532,
    priceSensitivity: 0.5,     // Low — rice is essential
    volatility: 0.03,          // Very stable
    category: 'GROCERY',
    isStaple: true,
    seasonalCategories: [],
  },
  'Cooking Oil (1L)': {
    productName: 'Cooking Oil (1L)',
    baseDemand: 0.503,
    priceSensitivity: 0.5,
    volatility: 0.04,
    category: 'GROCERY',
    isStaple: true,
    seasonalCategories: [],
  },
  'Eggs (12pc)': {
    productName: 'Eggs (12pc)',
    baseDemand: 0.562,
    priceSensitivity: 0.6,
    volatility: 0.05,
    category: 'GROCERY',
    isStaple: true,
    seasonalCategories: [],
  },
  'Milk (1L)': {
    productName: 'Milk (1L)',
    baseDemand: 0.473,
    priceSensitivity: 0.6,
    volatility: 0.05,
    category: 'GROCERY',
    isStaple: true,
    seasonalCategories: [],
  },
  'Snacks': {
    productName: 'Snacks',
    baseDemand: 0.414,
    priceSensitivity: 1.0,
    volatility: 0.08,
    category: 'GROCERY',
    isStaple: false,
    seasonalCategories: [],
  },
  'Soft Drinks': {
    productName: 'Soft Drinks',
    baseDemand: 0.443,
    priceSensitivity: 1.2,
    volatility: 0.10,
    category: 'COLD_DRINKS',
    isStaple: false,
    seasonalCategories: ['HEATWAVE'],
  },

  // ---- Clothing Products ----
  "Men's Shirt": {
    productName: "Men's Shirt",
    baseDemand: 0.081,
    priceSensitivity: 1.0,
    volatility: 0.08,
    category: 'CLOTHING',
    isStaple: false,
    seasonalCategories: ['EID_SHOPPING', 'PUJA_FESTIVAL'],
  },
  "Men's Pants": {
    productName: "Men's Pants",
    baseDemand: 0.069,
    priceSensitivity: 1.0,
    volatility: 0.08,
    category: 'CLOTHING',
    isStaple: false,
    seasonalCategories: ['EID_SHOPPING', 'PUJA_FESTIVAL'],
  },
  "Women's Saree": {
    productName: "Women's Saree",
    baseDemand: 0.092,
    priceSensitivity: 0.8,     // Lower sensitivity — saree buyers are less price-sensitive
    volatility: 0.10,
    category: 'CLOTHING',
    isStaple: false,
    seasonalCategories: ['EID_SHOPPING', 'PUJA_FESTIVAL', 'WEDDING_SEASON'],
  },
  "Women's Salwar Kameez": {
    productName: "Women's Salwar Kameez",
    baseDemand: 0.086,
    priceSensitivity: 0.9,
    volatility: 0.09,
    category: 'CLOTHING',
    isStaple: false,
    seasonalCategories: ['EID_SHOPPING', 'PUJA_FESTIVAL'],
  },
  "Kids' Clothing Set": {
    productName: "Kids' Clothing Set",
    baseDemand: 0.075,
    priceSensitivity: 1.1,     // Parents are price-conscious for kids' clothes
    volatility: 0.10,
    category: 'CLOTHING',
    isStaple: false,
    seasonalCategories: ['EID_SHOPPING'],
  },
  'Winter Jacket': {
    productName: 'Winter Jacket',
    baseDemand: 0.046,
    priceSensitivity: 1.0,
    volatility: 0.20,          // Very volatile — only sells in winter
    category: 'WINTER_CLOTHING',
    isStaple: false,
    seasonalCategories: ['WINTER_SEASON'],
  },

  // ---- Mobile & Electronics Products ----
  'Budget Smartphone': {
    productName: 'Budget Smartphone',
    baseDemand: 0.069,
    priceSensitivity: 1.2,     // High — many competing budget phones
    volatility: 0.10,
    category: 'MOBILE',
    isStaple: false,
    seasonalCategories: ['NEW_PHONE_LAUNCH'],
  },
  'Mid-Range Smartphone': {
    productName: 'Mid-Range Smartphone',
    baseDemand: 0.052,
    priceSensitivity: 1.3,
    volatility: 0.12,
    category: 'MOBILE',
    isStaple: false,
    seasonalCategories: ['NEW_PHONE_LAUNCH'],
  },
  'Premium Smartphone': {
    productName: 'Premium Smartphone',
    baseDemand: 0.026,
    priceSensitivity: 1.5,     // Very high — customers compare carefully at this price
    volatility: 0.20,          // Very volatile
    category: 'PREMIUM_MOBILE',
    isStaple: false,
    seasonalCategories: ['NEW_PHONE_LAUNCH'],
  },
  'Earphones': {
    productName: 'Earphones',
    baseDemand: 0.077,
    priceSensitivity: 1.0,
    volatility: 0.08,
    category: 'MOBILE',
    isStaple: false,
    seasonalCategories: [],
  },
  'Smart Watch': {
    productName: 'Smart Watch',
    baseDemand: 0.043,
    priceSensitivity: 1.2,
    volatility: 0.15,
    category: 'MOBILE',
    isStaple: false,
    seasonalCategories: [],
  },
  'Phone Case': {
    productName: 'Phone Case',
    baseDemand: 0.073,
    priceSensitivity: 1.4,     // Very high — cheap item, easy to comparison shop
    volatility: 0.06,
    category: 'MOBILE',
    isStaple: false,
    seasonalCategories: ['NEW_PHONE_LAUNCH'],
  },

  // ---- Restaurant Products ----
  'Rice Plate (Bhat)': {
    productName: 'Rice Plate (Bhat)',
    baseDemand: 0.738,
    priceSensitivity: 0.8,     // Moderate — daily meal, somewhat inelastic
    volatility: 0.05,
    category: 'RESTAURANT',
    isStaple: true,
    seasonalCategories: [],
  },
  'Chicken Curry': {
    productName: 'Chicken Curry',
    baseDemand: 0.665,
    priceSensitivity: 0.9,
    volatility: 0.07,
    category: 'RESTAURANT',
    isStaple: false,
    seasonalCategories: ['EID_SHOPPING', 'CRICKET_MATCH'],
  },
  'Fish Curry': {
    productName: 'Fish Curry',
    baseDemand: 0.517,
    priceSensitivity: 0.9,
    volatility: 0.10,          // Fish prices fluctuate
    category: 'RESTAURANT',
    isStaple: false,
    seasonalCategories: [],
  },
  'Dal (Lentil)': {
    productName: 'Dal (Lentil)',
    baseDemand: 0.628,
    priceSensitivity: 0.6,     // Low — cheap staple
    volatility: 0.04,
    category: 'RESTAURANT',
    isStaple: true,
    seasonalCategories: [],
  },
  'Kacchi Biryani': {
    productName: 'Kacchi Biryani',
    baseDemand: 0.701,
    priceSensitivity: 0.7,     // Somewhat inelastic — it's a specialty
    volatility: 0.08,
    category: 'RESTAURANT',
    isStaple: false,
    seasonalCategories: ['EID_SHOPPING', 'CRICKET_MATCH', 'PUJA_FESTIVAL'],
  },
  'Roti/Naan': {
    productName: 'Roti/Naan',
    baseDemand: 0.665,
    priceSensitivity: 0.7,
    volatility: 0.05,
    category: 'RESTAURANT',
    isStaple: true,
    seasonalCategories: [],
  },
};

export function getProductDemandConfig(productName: string): ProductDemandConfig {
  return PRODUCT_DEMAND_CONFIG[productName] ?? {
    productName,
    baseDemand: 0.5,
    priceSensitivity: 1.0,
    volatility: 0.10,
    category: 'UNKNOWN',
    isStaple: false,
    seasonalCategories: [],
  };
}
