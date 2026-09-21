'use client';

import { useCallback, useEffect, useState } from 'react';
import SupplierPanel from './SupplierPanel';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Loader2,
  PackagePlus,
  Truck,
  Warehouse,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatTaka } from '@/lib/game-data';
import { useBusinessDetail } from './context';
import { useCalendar } from '@/hooks/use-calendar';

interface GodownOffer {
  tier: string;
  en: string;
  icon: string;
  capacityBonus: number;
  terms: { days: number; cost: number }[];
  available: boolean;
}

interface StoragePayload {
  gameDay: number;
  capacity: {
    selling: number;
    rented: number;
    storage: number;
    held: number;
    incoming: number;
    available: number;
    utilisation: number;
    overCapacity: boolean;
  };
  godowns: {
    id: string;
    tierEn: string;
    icon: string;
    capacityBonus: number;
    expiresOnDay: number;
    daysRemaining: number;
    autoRenew: boolean;
    expiringSoon: boolean;
  }[];
  preOrders: {
    id: string;
    productName: string;
    quantity: number;
    unitCost: number;
    discount: number;
    totalCost: number;
    deliveryDay: number;
    daysUntilDelivery: number;
  }[];
  recentOrders: {
    id: string;
    productName: string;
    quantity: number;
    deliveredQuantity: number;
    refunded: number;
    status: string;
    note: string | null;
  }[];
  godownOffers: GodownOffer[];
  limits: {
    minLeadDays: number;
    maxLeadDays: number;
    minOrderQuantity: number;
    cancellationFee: number;
  };
  quote: {
    quantity: number;
    listUnitCost: number;
    unitCost: number;
    discount: number;
    totalCost: number;
    saving: number;
  } | null;
}

/**
 * Storage and pre-buying.
 *
 * The calendar tells a player that Eid will multiply clothing demand by 2.8.
 * Shelf space is 92 units and scales with nothing, so before this screen
 * existed the only honest response to that warning was to watch it happen.
 * Here they can rent space and commit to stock ahead of the rush.
 */
export default function StorageTab() {
  const { currentBusiness } = useBusinessDetail();
  const calendar = useCalendar();

  const [data, setData] = useState<StoragePayload | null>(null);
  const [busy, setBusy] = useState(false);
  /** Bumped after an action to pull fresh state. */
  const [refreshKey, setRefreshKey] = useState(0);


  const businessId = currentBusiness?.id;

  // Loaded the way the rest of this codebase loads panel data: the fetch lives
  // in the effect and state is set from its `then`, not synchronously in the
  // effect body. An earlier version routed the live quote through the same
  // request, which made the loader depend on the day it had itself fetched.
  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;

    fetch(`/api/businesses/${businessId}/storage`)
      .then(res => (res.ok ? res.json() : null))
      .then((payload: StoragePayload | null) => {
        if (!cancelled && payload) setData(payload);
      })
      .catch(() => {
        // The panel is information; a failure leaves the last good state.
      });

    return () => { cancelled = true; };
  }, [businessId, refreshKey]);

  /**
   * The Bangladeshi date a game day lands on, and anything happening then.
   *
   * This is the point of the whole screen: "day 34" means nothing, "four days
   * before Eid-ul-Fitr" is the reason to order now.
   */
  const dayContext = useCallback(
    (gameDay: number) => {
      if (!calendar || !data) return null;
      const offset = gameDay - calendar.world.gameDay;
      const base = new Date(`${calendar.world.date}T00:00:00Z`);
      base.setUTCDate(base.getUTCDate() + offset);
      const date = base.toISOString().slice(0, 10);

      const observance = calendar.year.observances.find(o => o.date <= date && date <= o.endDate)
        ?? calendar.year.observances.find(o => o.date > date);

      return {
        date,
        observance: observance ?? null,
        isDuring: observance ? observance.date <= date && date <= observance.endDate : false,
      };
    },
    [calendar, data],
  );

  const act = async (fn: () => Promise<Response>, success: string) => {
    setBusy(true);
    try {
      const res = await fn();
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(success);
        setRefreshKey(key => key + 1);
      } else {
        toast.error(body?.error?.message ?? 'That did not work.');
      }
    } catch {
      toast.error('Network error.');
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <Skeleton className="h-96 w-full rounded-xl" />;

  const { capacity, limits } = data;

  return (
    <div className="space-y-4">
      {/* ---- Capacity ---- */}
      <div className="bt-surface-raised p-4">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="bt-tone bt-tone-sky mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg">
            <Warehouse className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">Storage</h3>
              <span className="bt-numeric text-xs text-muted-foreground">
                {capacity.held.toLocaleString()} / {capacity.storage.toLocaleString()} units
              </span>
            </div>

            <Progress
              value={capacity.utilisation * 100}
              className={cn('mt-2 h-2', capacity.overCapacity && '[&>div]:bg-red-500')}
            />

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Shelves', value: capacity.selling, hint: 'sets demand' },
                { label: 'Rented', value: capacity.rented, hint: 'godowns' },
                { label: 'On order', value: capacity.incoming, hint: 'space reserved' },
                { label: 'Free', value: capacity.available, hint: 'can still buy' },
              ].map(cell => (
                <div key={cell.label} className="bt-surface p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{cell.label}</p>
                  <p className="bt-numeric text-sm font-bold">{cell.value.toLocaleString()}</p>
                  <p className="text-[9px] text-muted-foreground">{cell.hint}</p>
                </div>
              ))}
            </div>

            {/* Shelf space is what customers see; the rest is a back room. */}
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Only the <strong>{capacity.selling.toLocaleString()}</strong> units on your shelves affect how
              busy the shop looks. Rented space lets you hold stock for a rush — it does not bring customers in.
            </p>

            {capacity.overCapacity && (
              <p className="bt-tone bt-tone-crimson mt-2 flex items-start gap-1.5 rounded-lg p-2 text-[11px]">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                You are holding more than you have room for — a rental ended. Your stock is safe, but you
                cannot buy more until you sell some or rent again.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ---- Rentals ---- */}
      <div className="bt-surface-raised p-4">
        <h3 className="mb-3 text-sm font-semibold">Rented space</h3>

        {data.godowns.length > 0 && (
          <ul className="mb-3 space-y-2">
            {data.godowns.map(g => (
              <li key={g.id} className="bt-surface flex flex-wrap items-center gap-2 p-2.5">
                <span aria-hidden="true" className="text-lg">{g.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">
                    {g.tierEn} <span className="bt-numeric text-muted-foreground">+{g.capacityBonus} units</span>
                  </p>
                  <p className={cn('text-[10px]', g.expiringSoon ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                    {g.daysRemaining > 0 ? `${g.daysRemaining} days left` : 'ending today'}
                    {g.expiringSoon && ' — renew or move the stock'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Label htmlFor={`renew-${g.id}`} className="text-[10px] text-muted-foreground">Auto-renew</Label>
                  <Switch
                    id={`renew-${g.id}`}
                    checked={g.autoRenew}
                    disabled={busy}
                    onCheckedChange={checked =>
                      act(
                        () => fetch(`/api/businesses/${businessId}/storage/godown/${g.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ autoRenew: checked }),
                        }),
                        checked ? 'Will renew automatically.' : 'Auto-renew off.',
                      )
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-2 sm:grid-cols-3">
          {data.godownOffers.map(offer => (
            <div key={offer.tier} className={cn('bt-surface p-3', !offer.available && 'opacity-50')}>
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="text-lg">{offer.icon}</span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{offer.en}</p>
                  <p className="bt-numeric text-[10px] text-muted-foreground">+{offer.capacityBonus} units</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {offer.terms.map(term => (
                  <Button
                    key={term.days}
                    size="sm"
                    variant="outline"
                    disabled={busy || !offer.available}
                    className="h-7 flex-1 px-2 text-[10px]"
                    onClick={() =>
                      act(
                        () => fetch(`/api/businesses/${businessId}/storage/godown`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ tier: offer.tier, termDays: term.days }),
                        }),
                        `Rented for ${term.days} days.`,
                      )
                    }
                  >
                    {term.days}d · {formatTaka(term.cost)}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {!data.godownOffers[0]?.available && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            This shop already has as many rentals as it can hold.
          </p>
        )}
      </div>

      {/* ---- Buying, which is now a decision rather than a button ---- */}
      <SupplierPanel businessId={businessId!} onOrdered={() => setRefreshKey(key => key + 1)} />

      {/* ---- On the way ---- */}
      <div className="bt-surface-raised p-4">
        <h3 className="mb-3 text-sm font-semibold">
          On the way
          {data.preOrders.length > 0 && (
            <span className="bt-numeric ml-1 text-xs font-normal text-muted-foreground">
              ({data.preOrders.length})
            </span>
          )}
        </h3>

        {data.preOrders.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Nothing ordered. Stock bought ahead of a rush arrives on the day you pick, whether you are here or not.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.preOrders.map(order => {
              const context = dayContext(order.deliveryDay);
              return (
                <li key={order.id} className="bt-surface flex flex-wrap items-center gap-2 p-2.5">
                  <Truck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">
                      {order.quantity} × {order.productName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      <span className="bt-numeric">
                        {order.daysUntilDelivery <= 0
                          ? 'arriving now'
                          : `in ${order.daysUntilDelivery} days`}
                      </span>
                      {context?.observance && context.isDuring && ` · during ${context.observance.en}`}
                      {' · '}
                      <span className="bt-numeric">{formatTaka(order.totalCost)} paid</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    className="h-7 px-2 text-[10px]"
                    onClick={() =>
                      act(
                        () => fetch(`/api/businesses/${businessId}/storage/orders/${order.id}`, { method: 'DELETE' }),
                        `Cancelled — ${Math.round(limits.cancellationFee * 100)}% fee kept.`,
                      )
                    }
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                    Cancel
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {data.preOrders.length > 0 && (
          <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Check className="h-3 w-3" aria-hidden="true" />
            Already paid for, and the space is reserved. Cancelling returns all but{' '}
            {Math.round(limits.cancellationFee * 100)}%.
          </p>
        )}

        {/* Settled orders. Without these an order simply vanished on the day it
            landed, with nothing to confirm it arrived — or that part of it was
            refunded because a rental had lapsed under it. */}
        {data.recentOrders.length > 0 && (
          <div className="mt-4 border-t border-[var(--bt-hairline)] pt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Recently settled
            </p>
            <ul className="space-y-1.5">
              {data.recentOrders.map(order => (
                <li key={order.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                  <Badge
                    variant="outline"
                    className={cn(
                      'bt-tone shrink-0 rounded-full px-2 text-[9px]',
                      order.status === 'DELIVERED' ? 'bt-tone-emerald'
                        : order.status === 'PARTIAL' ? 'bt-tone-amber'
                        : 'bt-tone-slate',
                    )}
                  >
                    {order.status.toLowerCase()}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {order.deliveredQuantity > 0
                      ? `${order.deliveredQuantity} of ${order.quantity} × ${order.productName}`
                      : `${order.quantity} × ${order.productName}`}
                  </span>
                  {order.refunded > 0 && (
                    <span className="bt-numeric shrink-0 text-amber-600 dark:text-amber-400">
                      {formatTaka(order.refunded)} back
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
