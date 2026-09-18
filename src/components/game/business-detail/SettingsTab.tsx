'use client';

import { ArrowUp, HandCoins } from 'lucide-react';
import { toast } from 'sonner';
import { formatTaka } from '@/lib/game-data';
import { ROUTES } from '@/lib/game-routes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useGameStore } from '@/store/game-store';
import { apiErrorMessage } from '@/lib/api-error';
import { useBusinessDetail } from './context';

/**
 * Upgrading the shop, and selling it.
 *
 * Split out of `BusinessDetail.tsx`, which had grown to 1,729 lines — long
 * past the point where the panel you were editing could be found, let alone
 * reviewed. The markup is unchanged; only its home is.
 */
export default function SettingsTab() {
  const {
    bt,
    city,
    currentBusiness,
    handleUpgrade,
    inventories,
    player,
    router,
    sellBusinessConfirm,
    sellingBusiness,
    setSellBusinessConfirm,
    setSellingBusiness,
    setShowSellBusinessDialog,
    showSellBusinessDialog,
    upgradeCost,
    upgrading,
  } = useBusinessDetail();

  return (
    <>
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
                <div className="text-xs text-muted-foreground">Your cash: {formatTaka(player?.cash || 0)}</div>
              </div>
              <Button onClick={handleUpgrade} disabled={upgrading || (player?.cash || 0) < upgradeCost} className="text-white" style={{ background: '#006a4e' }}>
                {upgrading ? 'Upgrading...' : 'Upgrade'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-900/60">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-red-600 dark:text-red-400"><HandCoins className="h-4 w-4" /> Sell Business</CardTitle>
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
                className="text-red-600 dark:text-red-400 border-red-300 dark:border-red-800/70 hover:bg-red-50 dark:hover:bg-red-950/40 dark:bg-red-950/40 gap-1.5"
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
              <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <HandCoins className="h-5 w-5" />
                Sell Business
              </DialogTitle>
              <DialogDescription>
                Permanently remove this business, all inventory, and all staff.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 p-3 space-y-2">
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
                  <span className="text-green-700 dark:text-green-300">{formatTaka(Math.round((bt?.investment || 50000) * (currentBusiness.level || 1) * Math.min(0.8, 0.5 + (currentBusiness.reputation || 0) * 0.001)) + inventories.reduce((sum: number, inv: any) => sum + Math.round((inv.purchasePrice || 0) * (inv.quantity || 0) * 0.7), 0))}</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Type business name to confirm:</label>
                <input
                  type="text"
                  value={sellBusinessConfirm}
                  onChange={(e) => setSellBusinessConfirm(e.target.value)}
                  placeholder={currentBusiness.name}
                  className="mt-1 w-full h-10 px-3 rounded-lg border border-red-300 dark:border-red-800/70 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
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
                      router.push(ROUTES.businesses);
                      const bRes = await fetch('/api/businesses');
                      if (bRes.ok) useGameStore.getState().setBusinesses(await bRes.json());
                      const pRes = await fetch('/api/player');
                      if (pRes.ok) useGameStore.getState().setPlayer(await pRes.json());
                    } else {
                      const err = await res.json();
                      toast.error(apiErrorMessage(err, 'Failed to sell'));
                    }
                  } catch { toast.error('Network error'); }
                  finally { setSellingBusiness(false); }
                }}
                disabled={sellingBusiness || sellBusinessConfirm !== currentBusiness.name}
                className="bg-red-600 dark:bg-red-600 hover:bg-red-700 text-white"
              >
                {sellingBusiness ? 'Selling...' : 'Confirm Sale'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
