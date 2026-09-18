'use client';

import { motion } from 'framer-motion';
import { Check, Lightbulb, PackageOpen, ShoppingCart, Sparkles, TrendingDown, TrendingUp, X } from 'lucide-react';
import { formatTaka } from '@/lib/game-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useBusinessDetail } from './context';

/**
 * Shelves, shelf prices, buying and selling stock, and the standing restock order.
 *
 * Split out of `BusinessDetail.tsx`, which had grown to 1,729 lines — long
 * past the point where the panel you were editing could be found, let alone
 * reviewed. The markup is unchanged; only its home is.
 */
export default function InventoryTab() {
  const {
    analyticsData,
    bt,
    buyProduct,
    buyQuantity,
    buying,
    editPrice,
    fetchMarketProducts,
    getDemandColor,
    getDemandLabel,
    handleApplyPricing,
    handleBuy,
    handleFetchPricingAdvice,
    handleSell,
    handleUpdatePrice,
    inventories,
    isEditingPrice,
    loadingPricing,
    marketProducts,
    pricingAdvice,
    sellInventory,
    sellQuantity,
    selling,
    setBuyProduct,
    setBuyQuantity,
    setEditPrice,
    setIsEditingPrice,
    setSellInventory,
    setSellQuantity,
    setShowBuyDialog,
    setShowPricingPanel,
    setShowSellDialog,
    showBuyDialog,
    showPricingPanel,
    showSellDialog,
    restocking,
    handleRestockAll,
    restockSettings,
    setRestockSettings,
    savingRestock,
    handleSaveRestockSettings,
  } = useBusinessDetail();

  const pct = (value: number) => `${Math.round(value * 100)}%`;

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Inventory ({inventories.length})</h3>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handleFetchPricingAdvice} disabled={loadingPricing}>
              <Lightbulb className="h-3.5 w-3.5" /> {loadingPricing ? '...' : 'Pricing'}
            </Button>
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handleRestockAll} disabled={restocking}>
              <PackageOpen className="h-3.5 w-3.5" /> {restocking ? '...' : 'Restock all'}
            </Button>
            <Button size="sm" className="gap-1 text-white text-xs" style={{ background: '#006a4e' }} onClick={() => { if (marketProducts.length === 0) { fetchMarketProducts(); } setShowBuyDialog(true); }}>
              <ShoppingCart className="h-3.5 w-3.5" /> Buy Stock
            </Button>
          </div>
        </div>

        {/* ---- Standing restock order ----
            Stock empties in about a game day, and a game day is a minute of
            real time. Without this the core interaction of the game is re-buying
            the same six products every tick, for every shop owned. */}
        <Card className="game-gradient-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--bt-emerald)]" aria-hidden="true" />
                  Shop manager
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Keep this shop's shelves stocked automatically, out of your cash, before it opens each day.
                </CardDescription>
              </div>
              <Switch
                checked={restockSettings.autoRestock}
                disabled={savingRestock}
                aria-label="Automatic restocking"
                onCheckedChange={(checked) =>
                  handleSaveRestockSettings({ ...restockSettings, autoRestock: checked })
                }
              />
            </div>
          </CardHeader>

          {restockSettings.autoRestock && (
            <CardContent className="px-4 pb-4 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Top up when stock falls below</Label>
                  <span className="bt-numeric text-xs font-semibold">{pct(restockSettings.autoRestockThreshold)}</span>
                </div>
                <Slider
                  value={[restockSettings.autoRestockThreshold * 100]}
                  min={5}
                  max={80}
                  step={5}
                  disabled={savingRestock}
                  onValueChange={([value]) =>
                    setRestockSettings({ ...restockSettings, autoRestockThreshold: value / 100 })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Refill to</Label>
                  <span className="bt-numeric text-xs font-semibold">{pct(restockSettings.autoRestockTarget)}</span>
                </div>
                <Slider
                  value={[restockSettings.autoRestockTarget * 100]}
                  min={20}
                  max={100}
                  step={5}
                  disabled={savingRestock}
                  onValueChange={([value]) =>
                    setRestockSettings({ ...restockSettings, autoRestockTarget: value / 100 })
                  }
                />
                {restockSettings.autoRestockTarget <= restockSettings.autoRestockThreshold && (
                  <p className="text-xs text-red-500 dark:text-red-400">
                    Refill level has to be above the trigger, or the shop would order stock every single day and never settle.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="restock-budget">Daily spending cap (optional)</Label>
                <Input
                  id="restock-budget"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="No cap"
                  value={restockSettings.autoRestockBudget ?? ''}
                  disabled={savingRestock}
                  onChange={(e) =>
                    setRestockSettings({
                      ...restockSettings,
                      autoRestockBudget: e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to let the shop spend whatever it needs. It can never spend cash you do not have.
                </p>
              </div>

              <Button
                size="sm"
                className="w-full text-white"
                style={{ background: '#006a4e' }}
                disabled={
                  savingRestock ||
                  restockSettings.autoRestockTarget <= restockSettings.autoRestockThreshold
                }
                onClick={() => handleSaveRestockSettings(restockSettings)}
              >
                {savingRestock ? 'Saving...' : 'Save standing order'}
              </Button>
            </CardContent>
          )}
        </Card>

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
                      <button key={p.id || p.name} onClick={() => setBuyProduct(p)} className="w-full text-left p-3 rounded-lg border hover:border-green-400 dark:border-green-700/70 transition-all hover:shadow-md hover:shadow-green-100 hover:-translate-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{p.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground">Market: ৳{p.currentPrice?.toLocaleString() || p.basePrice?.toLocaleString()}</div>
                          </div>
                          <Badge className={`text-xs border ${getDemandColor(p.currentDemand || 1)}`} variant="outline">
                            {getDemandLabel(p.currentDemand || 1)}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-100 dark:border-green-900/60">
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
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/60">
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
                    You receive: <span className="font-bold text-amber-600 dark:text-amber-400">৳{(Math.round((sellInventory.purchasePrice || 0) * 0.7) * sellQuantity).toLocaleString()}</span>
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
          <div className="space-y-1.5 rounded-lg overflow-hidden border border-green-100 dark:border-green-900/60">
            {inventories.map((inv: any) => {
              const mp = marketProducts.find((p: any) => p.id === inv.productId || p.name === inv.productName);
              const liquidationPrice = Math.round((inv.purchasePrice || 0) * 0.7);
              return (
                <div key={inv.id} className="inventory-row flex items-center gap-3 p-3">
                  <span className="text-xl">{mp?.icon || inv.productName?.charAt(0)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{inv.productName}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border ${getDemandColor(mp?.currentDemand || 1)}`}>
                        {(() => {
                          const di = analyticsData?.demandIndicators?.[inv.productName];
                          if (di) {
                            const icon = di.level === 'VERY_HIGH' ? '🔥' : di.level === 'HIGH' ? '📈' : di.level === 'NORMAL' ? '➡️' : di.level === 'LOW' ? '📉' : '❄️';
                            const label = di.level === 'VERY_HIGH' ? 'Very High' : di.level === 'HIGH' ? 'High' : di.level === 'NORMAL' ? 'Normal' : di.level === 'LOW' ? 'Low' : 'Very Low';
                            return `${icon} ${label}`;
                          }
                          return `${getDemandLabel(mp?.currentDemand || 1)} demand`;
                        })()}
                      </span>
                      <span className="text-xs text-muted-foreground">Stock: {inv.quantity || 0}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Liq. price: ৳{liquidationPrice.toLocaleString()}/unit</div>
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
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdatePrice(inv.id)}><Check className="h-3 w-3 text-green-600 dark:text-green-400" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsEditingPrice(null)}><X className="h-3 w-3" /></Button>
                        </div>
                      ) : (
                        <button onClick={() => { setIsEditingPrice(inv.id); setEditPrice(String(inv.sellPrice || 0)); }} className="text-sm font-bold hover:underline transition-colors hover:text-green-700 dark:hover:text-green-300 dark:text-green-300" style={{ color: '#006a4e' }}>
                          ৳{(inv.sellPrice || 0).toLocaleString()}
                        </button>
                      )}
                      <div className="text-xs text-muted-foreground">sell price</div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 dark:bg-amber-950/40 shrink-0"
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
            <Card className="border-green-200 dark:border-green-900/60 bg-gradient-to-br from-green-50/40 to-[var(--bt-surface-1)]">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <Lightbulb className="h-4 w-4 text-amber-500 dark:text-amber-400" /> Pricing Assistant
                  </CardTitle>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowPricingPanel(false)}><X className="h-3 w-3" /></Button>
                </div>
                <CardDescription className="text-xs">AI-powered pricing recommendations based on market demand, reputation & staff</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-2">
                  {pricingAdvice.advice.map((item: any, i: number) => (
                    <div key={item.productName} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-green-100 dark:border-green-900/60 bg-white/60">
                      <span className="text-lg mt-0.5 shrink-0">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold truncate">{item.productName}</span>
                          <Badge variant="outline" className={`text-xs ${item.demandLevel === 'High' ? 'border-green-300 dark:border-green-800/70 text-green-700 dark:text-green-300' : item.demandLevel === 'Low' ? 'border-red-300 dark:border-red-800/70 text-red-600 dark:text-red-400' : 'border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300'}`}>
                            {item.demandLevel}
                          </Badge>
                          {item.weeklyTrend === 'up' && <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />}
                          {item.weeklyTrend === 'down' && <TrendingDown className="h-3 w-3 text-red-500 dark:text-red-400" />}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs">
                          <span className="text-muted-foreground">Buy: <span className="text-foreground font-medium">৳{item.purchasePrice.toLocaleString()}</span></span>
                          <span className="text-muted-foreground">Suggest: <span className="font-bold" style={{ color: '#006a4e' }}>৳{item.suggestedPrice.toLocaleString()}</span></span>
                          <span className="text-muted-foreground">Markup: <span className="font-medium">{item.suggestedMarkup}%</span></span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 italic">💡 {item.reason}</div>
                        {item.currentSellPrice && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">Current: ৳{item.currentSellPrice.toLocaleString()}</span>
                            {item.currentSellPrice > item.maxPrice && <span className="text-xs text-red-600 dark:text-red-400 font-medium">⚠️ Overpriced!</span>}
                            {item.currentSellPrice < item.minPrice && <span className="text-xs text-red-600 dark:text-red-400 font-medium">⚠️ Below cost!</span>}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 shrink-0 border-green-300 dark:border-green-800/70 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-950/40 dark:bg-green-950/40"
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
    </>
  );
}
