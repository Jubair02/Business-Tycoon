'use client';

import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatTaka, formatTakaShort, getBusinessType } from '@/lib/game-data';
import { TrendingUp, TrendingDown, Moon, PackageOpen, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The report shape `POST /api/game/presence` returns after an absence. */
export interface OfflineSummary {
  daysAway: number;
  daysTraded: number;
  daysDormant: number;
  revenue: number;
  profit: number;
  hitCap: boolean;
  businesses: {
    id: string;
    name: string;
    type: string;
    daysTraded: number;
    revenue: number;
    profit: number;
    daysDormant: number;
    outOfStock: boolean;
  }[];
}

/**
 * What happened while the player was away.
 *
 * The world runs on a server clock, so shops trade whether or not anyone is
 * watching — but only for a bounded stretch, after which they shutter until the
 * owner comes back. Both halves of that need saying plainly: a player who
 * returns to a week of earnings should see them, and a player whose shops sat
 * closed for most of the week needs to know that is why, rather than concluding
 * the game lost their progress.
 */
export default function WhileYouWereAway({
  summary,
  onClose,
}: {
  summary: OfflineSummary | null;
  onClose: () => void;
}) {
  if (!summary) return null;

  const profitable = summary.profit >= 0;
  const earners = [...summary.businesses].sort((a, b) => b.profit - a.profit);
  const outOfStock = summary.businesses.filter(b => b.outOfStock);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-[var(--bt-emerald)]" aria-hidden="true" />
            While you were away
          </DialogTitle>
          <DialogDescription>
            {summary.daysAway.toLocaleString()} day{summary.daysAway === 1 ? '' : 's'} passed in Bangladesh.
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {/* Headline numbers */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bt-tone bt-tone-emerald rounded-xl p-3">
              <p className="bt-label">Takings</p>
              <p className="bt-figure mt-1 text-lg bt-text-profit">{formatTakaShort(summary.revenue)}</p>
            </div>
            <div className={cn('bt-tone rounded-xl p-3', profitable ? 'bt-tone-emerald' : 'bt-tone-crimson')}>
              <p className="bt-label">Profit</p>
              <p className={cn('bt-figure mt-1 text-lg flex items-center gap-1', profitable ? 'bt-text-profit' : 'text-red-500 dark:text-red-400')}>
                {profitable
                  ? <TrendingUp className="h-4 w-4" aria-hidden="true" />
                  : <TrendingDown className="h-4 w-4" aria-hidden="true" />}
                {formatTakaShort(summary.profit)}
              </p>
            </div>
          </div>

          {/* The cap, explained — this is the part a player would otherwise
              read as lost progress. */}
          {summary.hitCap && (
            <div className="bt-tone bt-tone-amber flex items-start gap-2.5 rounded-xl p-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="text-xs">
                <p className="font-bold">
                  Your shops traded for {summary.daysTraded.toLocaleString()} days, then closed for {summary.daysDormant.toLocaleString()}.
                </p>
                <p className="mt-1 text-muted-foreground">
                  A shop runs unattended for up to eight hours. After that it shutters until you
                  are back — it earns nothing, but it pays no rent either. They are open again now.
                </p>
              </div>
            </div>
          )}

          {/* Empty shelves are the most common reason a return is disappointing. */}
          {outOfStock.length > 0 && (
            <div className="bt-tone bt-tone-crimson flex items-start gap-2.5 rounded-xl p-3">
              <PackageOpen className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="text-xs">
                <p className="font-bold">
                  {outOfStock.length} shop{outOfStock.length === 1 ? '' : 's'} sold out
                </p>
                <p className="mt-1 text-muted-foreground">
                  {outOfStock.map(b => b.name).join(', ')}. Switch on the shop manager in a shop&apos;s
                  Inventory tab and it will restock itself from now on.
                </p>
              </div>
            </div>
          )}

          {earners.length > 0 && (
            <div>
              <p className="bt-label mb-2">By shop</p>
              <ScrollArea className="max-h-52">
                <div className="space-y-1.5 pr-3">
                  {earners.map((biz) => {
                    const bt = getBusinessType(biz.type);
                    return (
                      <div key={biz.id} className="flex items-center gap-2.5 rounded-lg border border-[var(--bt-hairline)] p-2.5">
                        <span aria-hidden="true" className="text-base">{bt?.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{biz.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {biz.daysTraded.toLocaleString()} day{biz.daysTraded === 1 ? '' : 's'} trading
                            {biz.daysDormant > 0 && `, ${biz.daysDormant.toLocaleString()} closed`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={cn('bt-numeric text-sm font-bold', biz.profit >= 0 ? 'bt-text-profit' : 'text-red-500 dark:text-red-400')}>
                            {formatTakaShort(biz.profit)}
                          </p>
                          {biz.outOfStock && (
                            <Badge variant="outline" className="bt-tone bt-tone-crimson mt-0.5 rounded-full px-1.5 text-[10px]">
                              Sold out
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {earners.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              You had no shops trading while you were away.
            </p>
          )}
        </motion.div>

        <DialogFooter>
          <Button className="w-full text-white" style={{ background: '#006a4e' }} onClick={onClose}>
            Back to business — {formatTaka(summary.profit)} earned
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
