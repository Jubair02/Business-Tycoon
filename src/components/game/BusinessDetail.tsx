'use client';

import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '@/store/game-store';
import { formatTaka, formatTakaShort, getBusinessType, getCity, getEmployeeRole, GAME_CONFIG, EMPLOYEE_ROLES } from '@/lib/game-data';
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
import { ArrowLeft, Users, ShoppingCart, Trash2, Check, X, ArrowUp, TrendingUp, TrendingDown, FileText, HandCoins, PackageOpen, BarChart3, Lightbulb, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const BUSINESS_COLORS: Record<string, string> = {
  TEA_STALL: 'bg-amber-100 border-amber-300 text-amber-800',
  GROCERY: 'bg-green-100 border-green-300 text-green-800',
  CLOTHING: 'bg-purple-100 border-purple-300 text-purple-800',
  MOBILE: 'bg-blue-100 border-blue-300 text-blue-800',
  RESTAURANT: 'bg-red-100 border-red-300 text-red-800',
};

export default function BusinessDetail() {
  const { currentBusiness, setView, setCurrentBusiness, setBusinesses, player } = useGameStore();
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

  const fetchBusiness = useCallback(async () => {
    if (!currentBusiness?.id) return;
    try {
      const res = await fetch(`/api/businesses/${currentBusiness.id}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentBusiness(data);
      }
    } catch {
      toast.error('Failed to load business data');
    }
  }, [currentBusiness?.id, setCurrentBusiness]);

  const fetchMarketProducts = useCallback(async () => {
    if (!currentBusiness) return;
    try {
      const res = await fetch(`/api/market/products?type=${currentBusiness.type}&city=${currentBusiness.city}`);
      if (res.ok) {
        setMarketProducts(await res.json());
      }
    } catch {
      // silent
    }
  }, [currentBusiness]);

  const fetchLogs = useCallback(async () => {
    if (!currentBusiness?.id) return;
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/businesses/${currentBusiness.id}/logs`);
      if (res.ok) {
        setLogs(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLogsLoading(false);
    }
  }, [currentBusiness?.id]);

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
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to set price');
      }
    } catch { toast.error('Network error'); }
  };

  useEffect(() => {
    if (currentBusiness?.id) {
      fetchBusiness();
      fetchMarketProducts();
      fetchLogs();
    }
  }, [currentBusiness?.id, fetchBusiness, fetchMarketProducts, fetchLogs]);

  if (!currentBusiness) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">No business selected</p>
        <Button variant="outline" className="mt-2" onClick={() => setView('businesses')}>Back to Businesses</Button>
      </div>
    );
  }

  const bt = getBusinessType(currentBusiness.type);
  const city = getCity(currentBusiness.city);
  const profit = currentBusiness.dailyProfit || 0;
  const inventories = currentBusiness.inventories || [];
  const employees = currentBusiness.employees || [];
  const upgradeCost = Math.round((bt?.investment || 0) * (currentBusiness.level || 1) * 0.5);
  const bannerClass = BUSINESS_COLORS[currentBusiness.type] || 'bg-gray-100 border-gray-300';
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
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update price');
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
      } else {
        const err = await res.json();
        toast.error(err.error || 'Purchase failed');
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
        const sellPricePerUnit = Math.round((sellInventory.purchasePrice || 0) * 0.7);
        toast.success(`Sold ${sellQuantity}x ${sellInventory.productName} for ${formatTaka(sellPricePerUnit * sellQuantity)}`);
        setShowSellDialog(false);
        setSellInventory(null);
        setSellQuantity(1);
        setCurrentBusiness(data);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Sale failed');
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
      } else {
        const err = await res.json();
        toast.error(err.error || 'Hiring failed');
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
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to fire employee');
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
      } else {
        const err = await res.json();
        toast.error(err.error || 'Upgrade failed');
      }
    } catch {
      toast.error('Upgrade failed');
    } finally {
      setUpgrading(false);
    }
  };

  const getDemandColor = (demand: number) => {
    if (demand >= 1.2) return 'text-green-600 bg-green-50 border-green-200';
    if (demand >= 0.8) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-500 bg-red-50 border-red-200';
  };

  const getDemandLabel = (demand: number) => {
    if (demand >= 1.2) return 'High';
    if (demand >= 0.8) return 'Medium';
    return 'Low';
  };

  return (
    <div className="pb-24 md:pb-4">
      <Tabs defaultValue="overview" className="w-full">
      {/* Sticky header with tabs integrated */}
      <div className="sticky top-14 z-40 bg-white border-b">
        <div className={`px-3 md:px-4 py-3 md:py-4 game-hero-banner ${bannerClass}`}>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="shrink-0 hover:bg-white/50" onClick={() => setView('businesses')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl game-float">{bt?.icon}</span>
                <div className="min-w-0">
                  <h2 className="font-bold text-base truncate">{currentBusiness.name}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${bannerClass}`}>{bt?.name}</Badge>
                    <span className="text-[10px] opacity-80 flex items-center gap-1">📍 {city?.name}</span>
                  </div>
                </div>
              </div>
            </div>
            <Badge className="text-[10px] shrink-0 text-white font-bold" style={{ background: 'linear-gradient(135deg, #006a4e, #00a86b)' }}>Lv.{currentBusiness.level}</Badge>
          </div>
        </div>
        {/* Tabs inside the sticky block */}
        <div className="px-3 md:px-4 pt-2">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="inventory" className="text-xs">Inventory</TabsTrigger>
            <TabsTrigger value="employees" className="text-xs">Staff</TabsTrigger>
            <TabsTrigger value="logs" className="text-xs">Log</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
          </TabsList>
        </div>
      </div>

      <div className="p-3 md:p-4">

          <TabsContent value="overview">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Card className="border-l-4 border-l-green-500 game-stat-card game-shine">
                <CardContent className="p-3">
                  <div className="text-[10px] text-muted-foreground uppercase" style={{ letterSpacing: '0.08em' }}>Daily Revenue</div>
                  <div className="text-lg font-bold text-green-600 mt-0.5">{formatTakaShort(revenue)}</div>
                </CardContent>
              </Card>
              <Card className={`${profit >= 0 ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'} game-stat-card game-shine`}>
                <CardContent className="p-3">
                  <div className="text-[10px] text-muted-foreground uppercase" style={{ letterSpacing: '0.08em' }}>Daily Profit</div>
                  <div className={`text-lg font-bold mt-0.5 ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {profit >= 0 ? '+' : ''}{formatTakaShort(profit)}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-amber-500 game-stat-card game-shine">
                <CardContent className="p-3">
                  <div className="text-[10px] text-muted-foreground uppercase" style={{ letterSpacing: '0.08em' }}>Daily Expenses</div>
                  <div className="text-lg font-bold text-amber-600 mt-0.5">{formatTakaShort(expenses)}</div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-purple-500 game-stat-card game-shine">
                <CardContent className="p-3">
                  <div className="text-[10px] text-muted-foreground uppercase" style={{ letterSpacing: '0.08em' }}>Reputation</div>
                  <div className="text-lg font-bold mt-0.5">{currentBusiness.reputation || 0}%</div>
                </CardContent>
              </Card>
            </div>

            {/* Profit Breakdown */}
            <Card className="mb-4 game-gradient-card game-shine">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold game-gradient-text">Profit Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-muted-foreground">Revenue</span>
                  </div>
                  <span className="font-medium text-green-600">+{formatTakaShort(revenue)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <span className="text-muted-foreground">Expenses</span>
                  </div>
                  <span className="font-medium text-red-500">-{formatTakaShort(expenses)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>Net Profit</span>
                  <span className={profit >= 0 ? 'text-green-600' : 'text-red-500'}>
                    {profit >= 0 ? '+' : ''}{formatTakaShort(profit)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-4 game-shine">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold game-gradient-text">Reputation</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <Progress value={currentBusiness.reputation || 0} className="h-3" />
                <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                  <span>Poor</span><span>Average</span><span>Excellent</span>
                </div>
              </CardContent>
            </Card>

            {/* Business Performance chart from logs */}
            <Card className="game-shine">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold game-gradient-text flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4" /> Performance History
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {logs.length > 0 ? (() => {
                  const profitLogs = logs.filter((l: any) => l.type === 'PROFIT' || l.type === 'LOSS').slice(-14);
                  if (profitLogs.length === 0) return (
                    <div className="h-24 flex items-center justify-center">
                      <div className="text-center">
                        <BarChart3 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">No profit data yet. Advance days to see your chart.</p>
                      </div>
                    </div>
                  );
                  const maxAbs = Math.max(...profitLogs.map((l: any) => Math.abs(l.amount || 0)), 1);
                  return (
                    <div className="space-y-0.5">
                      <div className="h-24 flex items-end gap-[3px]">
                        {profitLogs.map((log: any, i: number) => {
                          const amount = log.amount || 0;
                          const h = Math.max(5, (Math.abs(amount) / maxAbs) * 85 + 10);
                          const isPositive = amount >= 0;
                          return (
                            <motion.div
                              key={log.id || i}
                              className="flex-1 rounded-t"
                              style={{
                                height: `${h}%`,
                                background: isPositive
                                  ? 'linear-gradient(to top, rgba(0, 106, 78, 0.7), rgba(0, 168, 107, 0.4))'
                                  : 'linear-gradient(to top, rgba(244, 42, 65, 0.6), rgba(244, 42, 65, 0.3))',
                              }}
                              initial={{ height: 0 }}
                              animate={{ height: `${h}%` }}
                              transition={{ delay: i * 0.03, duration: 0.3 }}
                              title={`${formatTaka(amount)}`}
                            />
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5">
                        <span>Last {profitLogs.length} days</span>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-green-600/60 inline-block" /> Profit</span>
                          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-red-500/60 inline-block" /> Loss</span>
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="h-24 flex items-center justify-center">
                    <div className="text-center">
                      <BarChart3 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">No data yet. Advance days to see your chart.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Inventory ({inventories.length})</h3>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handleFetchPricingAdvice} disabled={loadingPricing}>
                    <Lightbulb className="h-3.5 w-3.5" /> {loadingPricing ? '...' : 'Pricing'}
                  </Button>
                  <Button size="sm" className="gap-1 text-white text-xs" style={{ background: '#006a4e' }} onClick={() => { if (marketProducts.length === 0) { fetchMarketProducts(); } setShowBuyDialog(true); }}>
                    <ShoppingCart className="h-3.5 w-3.5" /> Buy Stock
                  </Button>
                </div>
              </div>

              <Dialog open={showBuyDialog} onOpenChange={setShowBuyDialog}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Buy Inventory</DialogTitle>
                      <DialogDescription>Choose a product and quantity to buy</DialogDescription>
                    </DialogHeader>
                    {!buyProduct ? (
                      <ScrollArea className="max-h-64">
                        <div className="space-y-2">
                          {marketProducts.map((p: any) => (
                            <button key={p.id || p.name} onClick={() => setBuyProduct(p)} className="w-full text-left p-3 rounded-lg border hover:border-green-400 transition-all hover:shadow-md hover:shadow-green-100 hover:-translate-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{p.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium">{p.name}</div>
                                  <div className="text-xs text-muted-foreground">Market: ৳{p.currentPrice?.toLocaleString() || p.basePrice?.toLocaleString()}</div>
                                </div>
                                <Badge className={`text-[10px] border ${getDemandColor(p.currentDemand || 1)}`} variant="outline">
                                  {getDemandLabel(p.currentDemand || 1)}
                                </Badge>
                              </div>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50/60 border border-green-100">
                          <span className="text-2xl">{buyProduct.icon}</span>
                          <div>
                            <div className="font-medium">{buyProduct.name}</div>
                            <div className="text-sm text-muted-foreground">Unit price: ৳{(buyProduct.currentPrice || buyProduct.basePrice || 0).toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Quantity</Label>
                          <Input type="number" min={1} max={buyProduct.maxStock || 100} value={buyQuantity} onChange={(e) => setBuyQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
                          <div className="text-sm text-muted-foreground">
                            Total cost: <span className="font-bold text-foreground">{formatTaka((buyProduct.currentPrice || buyProduct.basePrice || 0) * buyQuantity)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <DialogFooter className="gap-2">
                      {buyProduct && (
                        <Button variant="outline" onClick={() => { setBuyProduct(null); setBuyQuantity(1); }}>Back</Button>
                      )}
                      <Button onClick={buyProduct ? handleBuy : () => setShowBuyDialog(false)} disabled={buying || (!buyProduct)} className="text-white game-shine" style={{ background: 'linear-gradient(135deg, #006a4e 0%, #00895e 60%, #00a86b 100%)' }}>
                        {buying ? 'Buying...' : buyProduct ? `Buy for ${formatTaka((buyProduct.currentPrice || buyProduct.basePrice || 0) * buyQuantity)}` : 'Close'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={showSellDialog} onOpenChange={(open) => { if (!open) { setSellInventory(null); setSellQuantity(1); } setShowSellDialog(open); }}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Sell Inventory</DialogTitle>
                    <DialogDescription>Liquidate stock at 70% of purchase price</DialogDescription>
                  </DialogHeader>
                  {sellInventory && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50/60 border border-amber-100">
                        <span className="text-2xl">📦</span>
                        <div className="flex-1">
                          <div className="font-medium">{sellInventory.productName}</div>
                          <div className="text-xs text-muted-foreground">In stock: {sellInventory.quantity} units</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min={1}
                          max={sellInventory.quantity}
                          value={sellQuantity}
                          onChange={(e) => setSellQuantity(Math.max(1, Math.min(sellInventory.quantity, parseInt(e.target.value) || 1)))}
                        />
                        <div className="text-sm text-muted-foreground">
                          Purchase price: <span className="font-medium">৳{(sellInventory.purchasePrice || 0).toLocaleString()}</span>/unit
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Liquidation rate: <span className="font-medium">70%</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          You receive: <span className="font-bold text-amber-600">৳{(Math.round((sellInventory.purchasePrice || 0) * 0.7) * sellQuantity).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => { setShowSellDialog(false); setSellInventory(null); setSellQuantity(1); }}>Cancel</Button>
                    <Button onClick={handleSell} disabled={selling || !sellInventory} className="text-white" style={{ background: '#d97706' }}>
                      {selling ? 'Selling...' : sellInventory ? `Sell for ৳${(Math.round((sellInventory.purchasePrice || 0) * 0.7) * sellQuantity).toLocaleString()}` : 'Sell'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {inventories.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center">
                    <div className="text-4xl mb-2">📦</div>
                    <p className="text-sm text-muted-foreground">No inventory. Buy stock to start selling!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-1.5 rounded-lg overflow-hidden border border-green-100/60">
                  {inventories.map((inv: any) => {
                    const mp = marketProducts.find((p: any) => p.id === inv.productId || p.name === inv.productName);
                    const liquidationPrice = Math.round((inv.purchasePrice || 0) * 0.7);
                    return (
                      <div key={inv.id} className="inventory-row flex items-center gap-3 p-3">
                        <span className="text-xl">{mp?.icon || inv.productName?.charAt(0)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{inv.productName}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${getDemandColor(mp?.currentDemand || 1)}`}>
                              {getDemandLabel(mp?.currentDemand || 1)} demand
                            </span>
                            <span className="text-[10px] text-muted-foreground">Stock: {inv.quantity || 0}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">Liq. price: ৳{liquidationPrice.toLocaleString()}/unit</div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="text-right">
                            {isEditingPrice === inv.id ? (
                              <div className="flex items-center gap-1 game-price-edit rounded-md p-0.5">
                                <Input
                                  type="number"
                                  value={editPrice}
                                  onChange={(e) => setEditPrice(e.target.value)}
                                  className="w-20 h-7 text-xs"
                                  autoFocus
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleUpdatePrice(inv.id); if (e.key === 'Escape') setIsEditingPrice(null); }}
                                />
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdatePrice(inv.id)}><Check className="h-3 w-3 text-green-600" /></Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsEditingPrice(null)}><X className="h-3 w-3" /></Button>
                              </div>
                            ) : (
                              <button onClick={() => { setIsEditingPrice(inv.id); setEditPrice(String(inv.sellPrice || 0)); }} className="text-sm font-bold hover:underline transition-colors hover:text-green-700" style={{ color: '#006a4e' }}>
                                ৳{(inv.sellPrice || 0).toLocaleString()}
                              </button>
                            )}
                            <div className="text-[10px] text-muted-foreground">sell price</div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 shrink-0"
                            onClick={() => { setSellInventory(inv); setSellQuantity(Math.min(1, inv.quantity)); setShowSellDialog(true); }}
                          >
                            <PackageOpen className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pricing Advice Panel */}
              {showPricingPanel && pricingAdvice && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Card className="border-green-200/60 bg-gradient-to-br from-green-50/40 to-white">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                          <Lightbulb className="h-4 w-4 text-amber-500" /> Pricing Assistant
                        </CardTitle>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowPricingPanel(false)}><X className="h-3 w-3" /></Button>
                      </div>
                      <CardDescription className="text-xs">AI-powered pricing recommendations based on market demand, reputation & staff</CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="space-y-2">
                        {pricingAdvice.advice.map((item: any, i: number) => (
                          <div key={item.productName} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-green-100/50 bg-white/60">
                            <span className="text-lg mt-0.5 shrink-0">{item.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold truncate">{item.productName}</span>
                                <Badge variant="outline" className={`text-[9px] ${item.demandLevel === 'High' ? 'border-green-300 text-green-700' : item.demandLevel === 'Low' ? 'border-red-300 text-red-600' : 'border-amber-200 text-amber-700'}`}>
                                  {item.demandLevel}
                                </Badge>
                                {item.weeklyTrend === 'up' && <TrendingUp className="h-3 w-3 text-green-600" />}
                                {item.weeklyTrend === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-[10px]">
                                <span className="text-muted-foreground">Buy: <span className="text-foreground font-medium">৳{item.purchasePrice.toLocaleString()}</span></span>
                                <span className="text-muted-foreground">Suggest: <span className="font-bold" style={{ color: '#006a4e' }}>৳{item.suggestedPrice.toLocaleString()}</span></span>
                                <span className="text-muted-foreground">Markup: <span className="font-medium">{item.suggestedMarkup}%</span></span>
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5 italic">💡 {item.reason}</div>
                              {item.currentSellPrice && (
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-muted-foreground">Current: ৳{item.currentSellPrice.toLocaleString()}</span>
                                  {item.currentSellPrice > item.maxPrice && <span className="text-[9px] text-red-600 font-medium">⚠️ Overpriced!</span>}
                                  {item.currentSellPrice < item.minPrice && <span className="text-[9px] text-red-600 font-medium">⚠️ Below cost!</span>}
                                </div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px] gap-1 shrink-0 border-green-300 text-green-700 hover:bg-green-50"
                              onClick={() => handleApplyPricing(item.productName, item.suggestedPrice)}
                            >
                              <Sparkles className="h-3 w-3" /> Apply
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="employees">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Staff ({employees.length}/{GAME_CONFIG.maxEmployees})</h3>
                <Button size="sm" className="gap-1 text-white text-xs" style={{ background: '#006a4e' }} onClick={() => setShowHireDialog(true)} disabled={employees.length >= GAME_CONFIG.maxEmployees}>
                  <Users className="h-3.5 w-3.5" /> Hire
                </Button>
              </div>

              <Dialog open={showHireDialog} onOpenChange={setShowHireDialog}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Hire Employee</DialogTitle>
                    <DialogDescription>Choose a role for your new employee</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    {EMPLOYEE_ROLES.map((role) => (
                      <button
                        key={role.role}
                        onClick={() => setHireRole(role.role)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${hireRole === role.role ? 'border-green-500 bg-green-50' : 'hover:border-green-300'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{role.icon}</span>
                          <div className="flex-1">
                            <div className="text-sm font-medium">{role.label}</div>
                            <div className="text-xs text-muted-foreground">{role.description}</div>
                            <div className="text-xs mt-0.5">Salary: ~৳{role.baseSalary.toLocaleString()}/day</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowHireDialog(false)}>Cancel</Button>
                    <Button onClick={handleHire} disabled={!hireRole || hiring} className="text-white" style={{ background: '#006a4e' }}>
                      {hiring ? 'Hiring...' : 'Hire'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {employees.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center">
                    <div className="text-4xl mb-2">👥</div>
                    <p className="text-sm text-muted-foreground">No employees. Hire staff to boost your business!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {employees.map((emp: any) => {
                    const role = getEmployeeRole(emp.role);
                    return (
                      <Card key={emp.id}>
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl p-1.5 rounded-lg bg-muted">{role?.icon || '👤'}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{emp.name}</div>
                              <div className="text-xs text-muted-foreground">{role?.label || emp.role}</div>
                              <div className="flex gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px]">Skill: {emp.skill}/10</Badge>
                                <Badge variant="outline" className="text-[10px]">Eff: {emp.efficiency || 0}%</Badge>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-sm font-medium">৳{(emp.salary || 0).toLocaleString()}</div>
                              <div className="text-[10px] text-muted-foreground">salary/day</div>
                              <Button size="icon" variant="ghost" className="h-7 w-7 mt-1 text-red-400 hover:text-red-600" onClick={() => handleFire(emp.id)} disabled={firingId === emp.id}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" style={{ color: '#006a4e' }} /> Activity Log
                </h3>
                <Button size="sm" variant="outline" className="text-xs" onClick={fetchLogs}>
                  Refresh
                </Button>
              </div>

              {logsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Card key={i}><CardContent className="p-3"><Skeleton className="h-12 w-full" /></CardContent></Card>
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <div className="text-4xl mb-2">📋</div>
                    <p className="text-sm text-muted-foreground">No activity yet. Advance to the next day to generate logs!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {logs.map((log: any, i: number) => {
                    const isProfit = log.type === 'PROFIT';
                    return (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <Card className={isProfit ? 'border-l-4 border-l-green-400 game-gradient-card' : 'border-l-4 border-l-red-400 game-gradient-card'}>
                          <CardContent className="p-3">
                            <div className="flex items-start gap-3">
                              <div className={`mt-0.5 ${isProfit ? 'text-green-600' : 'text-red-500'}`}>
                                {isProfit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm">{log.message}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`text-xs font-bold ${isProfit ? 'text-green-600' : 'text-red-500'}`}>
                                    {isProfit ? '+' : '-'}{formatTakaShort(Math.abs(log.amount || 0))}
                                  </span>
                                  {log.createdAt && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {new Date(log.createdAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm">Business Info</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Name</span><span className="font-medium">{currentBusiness.name}</span></div>
                  <Separator />
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Type</span><span className="font-medium">{bt?.icon} {bt?.name}</span></div>
                  <Separator />
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">City</span><span className="font-medium">{city?.name}</span></div>
                  <Separator />
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Level</span><span className="font-medium">{currentBusiness.level || 1}</span></div>
                  <Separator />
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Reputation</span><span className="font-medium">{currentBusiness.reputation || 0}%</span></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2"><ArrowUp className="h-4 w-4" /> Upgrade Business</CardTitle>
                  <CardDescription>Upgrade to level {(currentBusiness.level || 1) + 1}. Increases capacity and +5 reputation.</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground">Upgrade Cost</div>
                      <div className="text-lg font-bold">{formatTaka(upgradeCost)}</div>
                      <div className="text-[10px] text-muted-foreground">Your cash: {formatTaka(player?.cash || 0)}</div>
                    </div>
                    <Button onClick={handleUpgrade} disabled={upgrading || (player?.cash || 0) < upgradeCost} className="text-white" style={{ background: '#006a4e' }}>
                      {upgrading ? 'Upgrading...' : 'Upgrade'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-200/60">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2 text-red-600"><HandCoins className="h-4 w-4" /> Sell Business</CardTitle>
                  <CardDescription>Sell and recover a portion of your investment based on reputation.</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">Estimated Value</div>
                      <div className="text-lg font-bold">{formatTaka(Math.round((bt?.investment || 50000) * (currentBusiness.level || 1) * Math.min(0.8, 0.5 + (currentBusiness.reputation || 0) * 0.001)))}</div>
                    </div>
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50 gap-1.5"
                      onClick={() => { setSellBusinessConfirm(''); setShowSellBusinessDialog(true); }}
                    >
                      <HandCoins className="h-4 w-4" />
                      Sell
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Dialog open={showSellBusinessDialog} onOpenChange={setShowSellBusinessDialog}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                      <HandCoins className="h-5 w-5" />
                      Sell Business
                    </DialogTitle>
                    <DialogDescription>
                      Permanently remove this business, all inventory, and all staff.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Business Value</span>
                        <span className="font-medium">{formatTaka(Math.round((bt?.investment || 50000) * (currentBusiness.level || 1) * Math.min(0.8, 0.5 + (currentBusiness.reputation || 0) * 0.001)))}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Inventory Liquidation</span>
                        <span className="font-medium">{formatTaka(inventories.reduce((sum: number, inv: any) => sum + Math.round((inv.purchasePrice || 0) * (inv.quantity || 0) * 0.7), 0))}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-sm font-bold">
                        <span>Total You Receive</span>
                        <span className="text-green-700">{formatTaka(Math.round((bt?.investment || 50000) * (currentBusiness.level || 1) * Math.min(0.8, 0.5 + (currentBusiness.reputation || 0) * 0.001)) + inventories.reduce((sum: number, inv: any) => sum + Math.round((inv.purchasePrice || 0) * (inv.quantity || 0) * 0.7), 0))}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Type business name to confirm:</label>
                      <input
                        type="text"
                        value={sellBusinessConfirm}
                        onChange={(e) => setSellBusinessConfirm(e.target.value)}
                        placeholder={currentBusiness.name}
                        className="mt-1 w-full h-10 px-3 rounded-lg border border-red-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                    </div>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setShowSellBusinessDialog(false)}>Cancel</Button>
                    <Button
                      onClick={async () => {
                        if (sellBusinessConfirm !== currentBusiness.name) return;
                        setSellingBusiness(true);
                        try {
                          const res = await fetch(`/api/businesses/${currentBusiness.id}/sell`, { method: 'POST' });
                          if (res.ok) {
                            const data = await res.json();
                            toast.success(`Sold for ${formatTaka(data.totalReceived)}`);
                            setView('businesses');
                            const bRes = await fetch('/api/businesses');
                            if (bRes.ok) useGameStore.getState().setBusinesses(await bRes.json());
                            const pRes = await fetch('/api/player');
                            if (pRes.ok) useGameStore.getState().setPlayer(await pRes.json());
                          } else {
                            const err = await res.json();
                            toast.error(err.error || 'Failed to sell');
                          }
                        } catch { toast.error('Network error'); }
                        finally { setSellingBusiness(false); }
                      }}
                      disabled={sellingBusiness || sellBusinessConfirm !== currentBusiness.name}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {sellingBusiness ? 'Selling...' : 'Confirm Sale'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}