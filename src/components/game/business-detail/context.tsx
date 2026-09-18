'use client';

import { createContext, useContext } from 'react';

/**
 * Everything the business-detail tabs share.
 *
 * `BusinessDetail.tsx` had grown to 1,729 lines, with eight tab panels, their
 * dialogs and all their handlers in one function body. The panels are now their
 * own components; the shell still owns the state and the fetching, and passes
 * it down here rather than through seven separate prop lists — the panels read
 * a lot of the same things, and threading thirty props through each one would
 * have traded one unreadable file for seven noisy ones.
 *
 * The values are deliberately loosely typed: the API payloads they come from
 * are untyped in this codebase, and inventing shapes here would be inventing
 * guarantees the endpoints do not make.
 */
export interface BusinessDetailContextValue {
  // ---- The business and its owner ----
  currentBusiness: any;
  player: any;
  bt: any;
  city: any;
  inventories: any[];
  employees: any[];
  revenue: number;
  expenses: number;
  profit: number;
  upgradeCost: number;
  router: any;

  // ---- Fetched panel data ----
  marketProducts: any[];
  logs: any[];
  logsLoading: boolean;
  analyticsData: any;
  analyticsLoading: boolean;
  cxData: any;
  cxLoading: boolean;
  pricingAdvice: any;
  loadingPricing: boolean;
  showPricingPanel: boolean;
  setShowPricingPanel: (open: boolean) => void;

  // ---- Refetching ----
  fetchBusiness: () => void;
  refreshPlayer: () => void;
  fetchMarketProducts: () => void;
  fetchLogs: () => void;
  fetchAnalytics: () => void;
  fetchCX: () => void;

  // ---- Pricing ----
  isEditingPrice: string | null;
  setIsEditingPrice: (id: string | null) => void;
  editPrice: string;
  setEditPrice: (value: string) => void;
  handleUpdatePrice: (invId: string) => void;
  handleFetchPricingAdvice: () => void;
  handleApplyPricing: (productName: string, price: number) => void;

  // ---- Buying and selling stock ----
  showBuyDialog: boolean;
  setShowBuyDialog: (open: boolean) => void;
  buyProduct: any;
  setBuyProduct: (product: any) => void;
  buyQuantity: number;
  setBuyQuantity: (quantity: number) => void;
  buying: boolean;
  handleBuy: () => void;
  showSellDialog: boolean;
  setShowSellDialog: (open: boolean) => void;
  sellInventory: any;
  setSellInventory: (inventory: any) => void;
  sellQuantity: number;
  setSellQuantity: (quantity: number) => void;
  selling: boolean;
  handleSell: () => void;

  // ---- Standing restock order ----
  restocking: boolean;
  handleRestockAll: () => void;
  restockSettings: RestockSettingsState;
  setRestockSettings: (settings: RestockSettingsState) => void;
  savingRestock: boolean;
  handleSaveRestockSettings: (settings: RestockSettingsState) => void;

  // ---- Staff ----
  showHireDialog: boolean;
  setShowHireDialog: (open: boolean) => void;
  hireRole: string;
  setHireRole: (role: string) => void;
  hiring: boolean;
  handleHire: () => void;
  firingId: string | null;
  handleFire: (empId: string) => void;

  // ---- The shop itself ----
  upgrading: boolean;
  handleUpgrade: () => void;
  showSellBusinessDialog: boolean;
  setShowSellBusinessDialog: (open: boolean) => void;
  sellingBusiness: boolean;
  setSellingBusiness: (selling: boolean) => void;
  sellBusinessConfirm: string;
  setSellBusinessConfirm: (value: string) => void;

  // ---- Small shared formatters ----
  getDemandColor: (demand: number) => string;
  getDemandLabel: (demand: number) => string;
}

/** The standing restock order as the settings form holds it. */
export interface RestockSettingsState {
  autoRestock: boolean;
  /** Share of shelf space below which a product is topped up, 0-1. */
  autoRestockThreshold: number;
  /** Share of shelf space to refill to, 0-1. */
  autoRestockTarget: number;
  /** Daily ceiling in taka, or null for uncapped. */
  autoRestockBudget: number | null;
}

const BusinessDetailContext = createContext<BusinessDetailContextValue | null>(null);

export const BusinessDetailProvider = BusinessDetailContext.Provider;

export function useBusinessDetail(): BusinessDetailContextValue {
  const context = useContext(BusinessDetailContext);
  if (!context) {
    throw new Error('useBusinessDetail must be used inside <BusinessDetailProvider>');
  }
  return context;
}
