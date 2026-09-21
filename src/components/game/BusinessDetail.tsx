'use client';

// ============================================
// Business detail — shell
// ============================================
//
// This file was 1,729 lines: eight tab panels, their dialogs and every
// handler in one component body. It now owns only the state, the fetching
// and the page chrome, and hands the panels down through a context (see
// `business-detail/context.tsx`). Each panel lives in its own file beside it.

import { useState, useEffect, useCallback } from 'react';
import { ROUTES } from '@/lib/game-routes';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/store/game-store';
import { formatTaka, formatTakaShort, getBusinessType, getCity, getEmployeeRole, GAME_CONFIG, EMPLOYEE_ROLES } from '@/lib/game-data';
import { apiErrorMessage } from '@/lib/api-error';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowLeft, Users, ShoppingCart, Trash2, Check, X, ArrowUp, TrendingUp, TrendingDown, FileText, HandCoins, PackageOpen, BarChart3, Lightbulb, Sparkles, Activity, DollarSign, Clock, Target, Heart, Star, MessageSquare, ThumbsUp, ThumbsDown, UserCircle, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import MarketingView from '@/components/game/MarketingView';
import { BusinessDetailProvider, type RestockSettingsState } from './business-detail/context';
import OverviewTab from './business-detail/OverviewTab';
import InventoryTab from './business-detail/InventoryTab';
import StorageTab from './business-detail/StorageTab';
import AnalyticsTab from './business-detail/AnalyticsTab';
import CxTab from './business-detail/CxTab';
import StaffTab from './business-detail/StaffTab';
import LogsTab from './business-detail/LogsTab';
import SettingsTab from './business-detail/SettingsTab';

/**
 * `businessId` comes from the /businesses/[id] route. It is accepted (and
 * ignored beyond documentation) so the component signature matches the route,
 * while the loaded record still comes from the store.
 */
export default function BusinessDetail({ businessId }: { businessId?: string } = {}) {
  const router = useRouter();
  const { currentBusiness, setCurrentBusiness, setBusinesses, player } = useGameStore();
  const [isEditingPrice, setIsEditingPrice] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [showHireDialog, setShowHireDialog] = useState(false);
  const [hireRole, setHireRole] = useState('');
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const [buyProduct, setBuyProduct] = useState<any>(null);
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [buying, setBuying] = useState(false);
  const [showSellDialog, setShowSellDialog] = useState(false);
  const [sellInventory, setSellInventory] = useState<any>(null);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [selling, setSelling] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [firingId, setFiringId] = useState<string | null>(null);
  const [marketProducts, setMarketProducts] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showSellBusinessDialog, setShowSellBusinessDialog] = useState(false);
  const [sellingBusiness, setSellingBusiness] = useState(false);
  const [sellBusinessConfirm, setSellBusinessConfirm] = useState('');
  const [pricingAdvice, setPricingAdvice] = useState<any>(null);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [showPricingPanel, setShowPricingPanel] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [cxData, setCxData] = useState<any>(null);
  const [cxLoading, setCxLoading] = useState(false);
  // Standing restock order.
  const [restocking, setRestocking] = useState(false);
  const [savingRestock, setSavingRestock] = useState(false);
  const [restockDraft, setRestockDraft] = useState<RestockSettingsState | null>(null);

  // The fetchers below close over these primitives rather than over
  // `currentBusiness` itself. Reading `currentBusiness?.id` inside a callback
  // while listing `currentBusiness?.id` as its dependency reads to the React
  // compiler as a dependency on the whole object, which is both less specific
  // than declared and enough to make it give up optimising this component.
  const loadedBusinessId: string | undefined = currentBusiness?.id;
  const loadedBusinessType: string | undefined = currentBusiness?.type;
  const loadedBusinessCity: string | undefined = currentBusiness?.city;

  const fetchBusiness = useCallback(async () => {
    if (!loadedBusinessId) return;
    try {
      const res = await fetch(`/api/businesses/${loadedBusinessId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentBusiness(data);
      }
    } catch {
      toast.error('Failed to load business data');
    }
  }, [loadedBusinessId, setCurrentBusiness]);

  const refreshPlayer = useCallback(async () => {
    try {
      const res = await fetch('/api/player');
      if (res.ok) {
        const data = await res.json();
        useGameStore.getState().setPlayer(data);
      }
    } catch { /* silent */ }
  }, []);

  const fetchMarketProducts = useCallback(async () => {
    if (!loadedBusinessType || !loadedBusinessCity) return;
    try {
      const res = await fetch(`/api/market/products?type=${loadedBusinessType}&city=${loadedBusinessCity}`);
      if (res.ok) {
        setMarketProducts(await res.json());
      }
    } catch {
      // silent
    }
  }, [loadedBusinessType, loadedBusinessCity]);

  const fetchLogs = useCallback(async () => {
    if (!loadedBusinessId) return;
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/businesses/${loadedBusinessId}/logs`);
      if (res.ok) {
        setLogs(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLogsLoading(false);
    }
  }, [loadedBusinessId]);

  const fetchAnalytics = useCallback(async () => {
    if (!loadedBusinessId) return;
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`/api/businesses/${loadedBusinessId}/analytics`);
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data.data || data);
      }
    } catch {
      // silent
    } finally {
      setAnalyticsLoading(false);
    }
  }, [loadedBusinessId]);

  const fetchCX = useCallback(async () => {
    if (!loadedBusinessId) return;
    setCxLoading(true);
    try {
      const res = await fetch(`/api/businesses/${loadedBusinessId}/cx`);
      if (res.ok) {
        setCxData(await res.json());
      }
    } catch {
      // silent
    } finally {
      setCxLoading(false);
    }
  }, [loadedBusinessId]);

  const handleFetchPricingAdvice = async () => {
    if (!currentBusiness?.id) return;
    setLoadingPricing(true);
    try {
      const res = await fetch(`/api/businesses/${currentBusiness.id}/pricing-advice`);
      if (res.ok) {
        const data = await res.json();
        setPricingAdvice(data);
        setShowPricingPanel(true);
      } else {
        toast.error('Failed to get pricing advice');
      }
    } catch { toast.error('Network error'); }
    finally { setLoadingPricing(false); }
  };

  const handleApplyPricing = async (productName: string, price: number) => {
    if (!currentBusiness?.id) return;
    const inv = inventories.find((i: any) => i.productName === productName);
    if (!inv) {
      toast.error('No inventory for this product. Buy stock first.');
      return;
    }
    try {
      const res = await fetch(`/api/businesses/${currentBusiness.id}/inventory/${inv.id}/price`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellPrice: price }),
      });
      if (res.ok) {
        toast.success(`${productName}: price set to ${formatTaka(price)}`);
        fetchBusiness();
        refreshPlayer();
      } else {
        const err = await res.json();
        toast.error(apiErrorMessage(err, 'Failed to set price'));
      }
    } catch { toast.error('Network error'); }
  };

  useEffect(() => {
    if (!loadedBusinessId) return;

    // Started off a resolved promise so that nothing these helpers do can write
    // state during the effect body itself. Each one flips a loading flag on
    // entry, and calling them straight from the effect made every panel render
    // twice on mount — the cascading-render pattern React 19 warns about.
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      return Promise.all([
        fetchBusiness(),
        fetchMarketProducts(),
        fetchLogs(),
        fetchAnalytics(),
        fetchCX(),
      ]);
    });

    return () => { cancelled = true; };
  }, [loadedBusinessId, fetchBusiness, fetchMarketProducts, fetchLogs, fetchAnalytics, fetchCX]);

  // The standing order as the server currently has it. It arrives on the
  // business payload, so there is nothing extra to fetch.
  const savedRestockSettings: RestockSettingsState = {
    autoRestock: Boolean(currentBusiness?.autoRestock),
    autoRestockThreshold: currentBusiness?.autoRestockThreshold ?? 0.4,
    autoRestockTarget: currentBusiness?.autoRestockTarget ?? 0.9,
    autoRestockBudget: currentBusiness?.autoRestockBudget ?? null,
  };
  const savedRestockKey = currentBusiness
    ? `${currentBusiness.id}:${savedRestockSettings.autoRestock}:${savedRestockSettings.autoRestockThreshold}:${savedRestockSettings.autoRestockTarget}:${savedRestockSettings.autoRestockBudget}`
    : null;

  // The form's unsaved edits, if any, otherwise what the server has. Resetting
  // the draft is done during render rather than in an effect — this is React's
  // documented way to drop state that mirrors something that has changed, and
  // it avoids the extra render pass an effect would cost on every refetch.
  const [draftKey, setDraftKey] = useState(savedRestockKey);
  if (draftKey !== savedRestockKey) {
    setDraftKey(savedRestockKey);
    setRestockDraft(null);
  }
  const restockSettings = restockDraft ?? savedRestockSettings;
  const setRestockSettings = setRestockDraft;

  if (!currentBusiness) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">No business selected</p>
        <Button variant="outline" className="mt-2" onClick={() => router.push(ROUTES.businesses)}>Back to Businesses</Button>
      </div>
    );
  }

  const bt = getBusinessType(currentBusiness.type);
  const city = getCity(currentBusiness.city);
  const profit = currentBusiness.dailyProfit || 0;
  const inventories = currentBusiness.inventories || [];
  const employees = currentBusiness.employees || [];
  const upgradeCost = Math.round((bt?.investment || 0) * (currentBusiness.level || 1) * 0.5);
  const revenue = currentBusiness.dailyRevenue || 0;
  const expenses = currentBusiness.dailyExpense || 0;

  const handleUpdatePrice = async (invId: string) => {
    const price = parseFloat(editPrice);
    if (isNaN(price) || price <= 0) {
      toast.error('Enter a valid price');
      return;
    }
    try {
      const res = await fetch(`/api/businesses/${currentBusiness.id}/inventory/${invId}/price`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellPrice: price }),
      });
      if (res.ok) {
        toast.success('Price updated!');
        setIsEditingPrice(null);
        fetchBusiness();
        refreshPlayer();
      } else {
        const err = await res.json();
        toast.error(apiErrorMessage(err, 'Failed to update price'));
      }
    } catch {
      toast.error('Failed to update price');
    }
  };

  const handleBuy = async () => {
    if (!buyProduct || buyQuantity < 1) return;
    setBuying(true);
    try {
      const res = await fetch(`/api/businesses/${currentBusiness.id}/inventory/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: buyProduct.id || buyProduct.productId,
          productName: buyProduct.name,
          category: currentBusiness.type,
          quantity: buyQuantity,
        }),
      });
      if (res.ok) {
        toast.success(`Bought ${buyQuantity}x ${buyProduct.name}`);
        setShowBuyDialog(false);
        setBuyQuantity(1);
        fetchBusiness();
        refreshPlayer();
      } else {
        const err = await res.json();
        toast.error(apiErrorMessage(err, 'Purchase failed'));
      }
    } catch {
      toast.error('Purchase failed');
    } finally {
      setBuying(false);
    }
  };

  const handleSell = async () => {
    if (!sellInventory || sellQuantity < 1) return;
    setSelling(true);
    try {
      const res = await fetch(`/api/businesses/${currentBusiness.id}/inventory/sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryId: sellInventory.id,
          quantity: sellQuantity,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Use server-returned sale data for the toast instead of client-side calculation
        if (data.sale) {
          toast.success(`Sold ${data.sale.quantity}x ${data.sale.productName} for ${formatTaka(data.sale.totalReceived)}`);
        } else {
          toast.success('Inventory sold successfully');
        }
        setShowSellDialog(false);
        setSellInventory(null);
        setSellQuantity(1);
        setCurrentBusiness(data.business || data);
        refreshPlayer();
      } else {
        const err = await res.json();
        toast.error(apiErrorMessage(err, 'Sale failed'));
      }
    } catch {
      toast.error('Sale failed');
    } finally {
      setSelling(false);
    }
  };

  const handleHire = async () => {
    if (!hireRole) return;
    setHiring(true);
    try {
      const res = await fetch(`/api/businesses/${currentBusiness.id}/employees/hire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: hireRole }),
      });
      if (res.ok) {
        toast.success('Employee hired!');
        setShowHireDialog(false);
        setHireRole('');
        fetchBusiness();
        refreshPlayer();
      } else {
        const err = await res.json();
        toast.error(apiErrorMessage(err, 'Hiring failed'));
      }
    } catch {
      toast.error('Hiring failed');
    } finally {
      setHiring(false);
    }
  };

  const handleFire = async (empId: string) => {
    setFiringId(empId);
    try {
      const res = await fetch(`/api/businesses/${currentBusiness.id}/employees/${empId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Employee fired');
        fetchBusiness();
        refreshPlayer();
      } else {
        const err = await res.json();
        toast.error(apiErrorMessage(err, 'Failed to fire employee'));
      }
    } catch {
      toast.error('Failed to fire employee');
    } finally {
      setFiringId(null);
    }
  };

  const handleUpgrade = async () => {
    if ((player?.cash || 0) < upgradeCost) {
      toast.error('Not enough cash!');
      return;
    }
    setUpgrading(true);
    try {
      const res = await fetch(`/api/businesses/${currentBusiness.id}/upgrade`, { method: 'POST' });
      if (res.ok) {
        toast.success('Business upgraded!');
        fetchBusiness();
        refreshPlayer();
      } else {
        const err = await res.json();
        toast.error(apiErrorMessage(err, 'Upgrade failed'));
      }
    } catch {
      toast.error('Upgrade failed');
    } finally {
      setUpgrading(false);
    }
  };

  /** The "Restock all" button: fill every shelf now, out of the player's cash. */
  const handleRestockAll = async () => {
    if (!currentBusiness?.id) return;
    setRestocking(true);
    try {
      const res = await fetch(`/api/businesses/${currentBusiness.id}/inventory/restock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 1 }),
      });
      const data = await res.json();
      if (res.ok) {
        if (!data.restocked) {
          toast.info('Every shelf is already full.');
        } else {
          toast.success(
            `Restocked ${data.unitsBought.toLocaleString()} units for ${formatTaka(data.totalCost)}` +
            (data.shortOfFunds ? ' — some lines were left short of cash.' : ''),
          );
        }
        fetchBusiness();
        refreshPlayer();
      } else {
        toast.error(apiErrorMessage(data, 'Restock failed'));
      }
    } catch {
      toast.error('Network error');
    } finally {
      setRestocking(false);
    }
  };

  /** Save the standing order the server runs each tick on the player's behalf. */
  const handleSaveRestockSettings = async (settings: RestockSettingsState) => {
    if (!currentBusiness?.id) return;
    setSavingRestock(true);
    try {
      const res = await fetch(`/api/businesses/${currentBusiness.id}/inventory/restock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (res.ok) {
        setRestockSettings(settings);
        toast.success(
          settings.autoRestock
            ? 'Standing order saved. This shop will keep its own shelves stocked.'
            : 'Standing order switched off.',
        );
        fetchBusiness();
      } else {
        toast.error(apiErrorMessage(data, 'Could not save the standing order'));
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSavingRestock(false);
    }
  };

  const getDemandColor = (demand: number) => {
    if (demand >= 1.2) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900/60';
    if (demand >= 0.8) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60';
    return 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60';
  };

  const getDemandLabel = (demand: number) => {
    if (demand >= 1.2) return 'High';
    if (demand >= 0.8) return 'Medium';
    return 'Low';
  };

  return (
    <BusinessDetailProvider
      value={{
        currentBusiness, player, bt, city, inventories, employees,
        revenue, expenses, profit, upgradeCost, router,
        marketProducts, logs, logsLoading,
        analyticsData, analyticsLoading, cxData, cxLoading,
        pricingAdvice, loadingPricing, showPricingPanel, setShowPricingPanel,
        fetchBusiness, refreshPlayer, fetchMarketProducts, fetchLogs, fetchAnalytics, fetchCX,
        isEditingPrice, setIsEditingPrice, editPrice, setEditPrice,
        handleUpdatePrice, handleFetchPricingAdvice, handleApplyPricing,
        showBuyDialog, setShowBuyDialog, buyProduct, setBuyProduct,
        buyQuantity, setBuyQuantity, buying, handleBuy,
        showSellDialog, setShowSellDialog, sellInventory, setSellInventory,
        sellQuantity, setSellQuantity, selling, handleSell,
        restocking, handleRestockAll, restockSettings, setRestockSettings,
        savingRestock, handleSaveRestockSettings,
        showHireDialog, setShowHireDialog, hireRole, setHireRole,
        hiring, handleHire, firingId, handleFire,
        upgrading, handleUpgrade,
        showSellBusinessDialog, setShowSellBusinessDialog,
        sellingBusiness, setSellingBusiness,
        sellBusinessConfirm, setSellBusinessConfirm,
        getDemandColor, getDemandLabel,
      }}
    >
    <div className="pb-[7.5rem] md:pb-6">
      <Tabs defaultValue="overview" className="w-full">
      {/* Sticky header with tabs integrated. bt-glass keeps it readable
          over scrolling content in both themes — it was hardcoded white. */}
      <div className="bt-glass sticky top-14 z-40">
        <div className="bt-ambient mx-auto max-w-[88rem] overflow-hidden px-4 py-3.5 md:px-6 md:py-4">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              className="bt-tap h-10 w-10 shrink-0 rounded-xl"
              onClick={() => router.push(ROUTES.businesses)}
              aria-label="Back to businesses"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <span className="bt-medallion bt-medallion-md hidden sm:grid" aria-hidden="true">{bt?.icon}</span>
            <span className="bt-medallion bt-medallion-sm sm:hidden" aria-hidden="true">{bt?.icon}</span>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">{currentBusiness.name}</h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <Badge variant="outline" className="bt-tone bt-tone-emerald shrink-0 rounded-full px-2 text-xs font-semibold">
                  {bt?.name}
                </Badge>
                <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {city?.name}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {analyticsData?.health && (
                <Badge
                  variant="outline"
                  className={cn(
                    'bt-tone bt-numeric gap-0.5 rounded-full px-2 text-xs font-bold',
                    analyticsData.health.score >= 60 ? 'bt-tone-emerald'
                      : analyticsData.health.score >= 40 ? 'bt-tone-amber'
                      : 'bt-tone-crimson',
                  )}
                  title={`Health score: ${analyticsData.health.score} of 100`}
                >
                  <Activity className="h-3 w-3" aria-hidden="true" />
                  {analyticsData.health.score}
                </Badge>
              )}
              <Badge
                className="bt-btn-gold shrink-0 rounded-full border-0 px-2 text-xs font-bold"
              >
                Lv.{currentBusiness.level}
              </Badge>
            </div>
          </div>
        </div>

        {/* Tabs: horizontally scrollable on mobile so 8 labels stay
            legible instead of being crushed into ~40px each. */}
        <div className="mx-auto max-w-[88rem] px-4 pb-2 md:px-6">
          <TabsList className="bt-tabstrip h-auto w-full bg-transparent p-0">
            {[
              ['overview', 'Overview'],
              ['inventory', 'Inventory'],
              ['storage', 'Storage'],
              ['analytics', 'Analytics'],
              ['cx', 'CX'],
              ['marketing', 'Marketing'],
              ['employees', 'Staff'],
              ['logs', 'Log'],
              ['settings', 'Settings'],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-lg px-3 py-2 text-xs font-semibold data-[state=active]:shadow-sm"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </div>

      <div className="mx-auto max-w-[88rem] px-4 py-4 md:px-6">

          <TabsContent value="overview">
            <OverviewTab />
          </TabsContent>

          <TabsContent value="inventory">
            <InventoryTab />
          </TabsContent>

          <TabsContent value="storage">
            <StorageTab />
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsTab />
          </TabsContent>

          <TabsContent value="cx">
            <CxTab />
          </TabsContent>

          <TabsContent value="marketing">
            <MarketingView businessId={currentBusiness.id} />
          </TabsContent>

          <TabsContent value="employees">
            <StaffTab />
          </TabsContent>

          <TabsContent value="logs">
            <LogsTab />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
    </BusinessDetailProvider>
  );
}