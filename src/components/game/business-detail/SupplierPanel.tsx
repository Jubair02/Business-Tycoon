'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, PackagePlus, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatTaka } from '@/lib/game-data';

interface SupplierProduct {
  name: string;
  category: string;
  icon: string;
  marketUnitCost: number;
  priceMultiplier: number;
  cheapToday: boolean;
  dearToday: boolean;
  shelfLifeDays: number;
  perishable: boolean;
}

interface SupplierOption {
  id: string;
  en: string;
  icon: string;
  note: string;
  leadDays: number;
  minQuantity: number;
  terms: { id: string; en: string; days: number; surcharge: number }[];
  quote: {
    unitCost: number;
    goodsValue: number;
    creditSurcharge: number;
    totalCost: number;
    bulkDiscount: number;
    savingVsCounter: number;
    dueOnDay: number;
  } | null;
  survival: { surviving: number; lost: number; lossShare: number } | null;
}

interface SupplierPayload {
  gameDay: number;
  credit: { open: number; overdue: number; totalOutstanding: number; blocked: boolean };
  products: SupplierProduct[];
  suppliers: SupplierOption[];
}

/**
 * Choosing a supplier.
 *
 * The four things a shopkeeper decides every week and a toggle used to decide
 * for them: **who** to buy from, **how much**, **when** — market prices move
 * every third tick, so buying into a dip beats any discount on offer — and **on
 * what terms**, cash today or goods now against a bill in thirty days.
 */
export default function SupplierPanel({
  businessId,
  onOrdered,
}: {
  businessId: string;
  onOrdered: () => void;
}) {
  const [data, setData] = useState<SupplierPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState(150);
  const [supplierId, setSupplierId] = useState('DISTRIBUTOR');
  const [term, setTerm] = useState('NET_0');
  const [extraDays, setExtraDays] = useState(0);

  // Fetched in the effect with state set from the `then`, matching how every
  // other panel in this codebase loads and keeping the React 19 compiler happy.
  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;

    const params = new URLSearchParams({ quantity: String(quantity), term });
    if (productName) params.set('product', productName);

    fetch(`/api/businesses/${businessId}/suppliers?${params}`)
      .then(res => (res.ok ? res.json() : null))
      .then((payload: SupplierPayload | null) => {
        if (!cancelled && payload) setData(payload);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [businessId, productName, quantity, term, refreshKey]);

  const product = useMemo(
    () => data?.products.find(p => p.name === (productName || data.products[0]?.name)) ?? null,
    [data, productName],
  );

  const supplier = useMemo(
    () => data?.suppliers.find(s => s.id === supplierId) ?? null,
    [data, supplierId],
  );

  if (!data) return <Skeleton className="h-80 w-full rounded-xl" />;

  const deliveryDay = data.gameDay + (supplier?.leadDays ?? 1) + extraDays;
  const belowMinimum = supplier ? quantity < supplier.minQuantity : false;
  const termOffered = supplier?.terms.some(t => t.id === term) ?? false;

  const place = async () => {
    if (!product || !supplier) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/storage/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: product.name,
          category: product.category,
          quantity,
          deliveryDay,
          supplier: supplier.id,
          term,
        }),
      });
      const body = await res.json().catch(() => ({}));

      if (res.ok) {
        toast.success(
          term === 'NET_0'
            ? 'Order placed and paid.'
            : `Order placed. ${formatTaka(supplier.quote?.totalCost ?? 0)} due on day ${supplier.quote?.dueOnDay}.`,
        );
        setRefreshKey(key => key + 1);
        onOrdered();
      } else {
        toast.error(body?.error?.message ?? 'That order was refused.');
      }
    } catch {
      toast.error('Network error.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bt-surface-raised p-4">
      <h3 className="mb-1 text-sm font-semibold">Buy from a supplier</h3>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Cheaper suppliers take longer and want bigger orders. Prices move every third day.
      </p>

      {data.credit.blocked && (
        <p className="bt-tone bt-tone-crimson mb-3 flex items-start gap-1.5 rounded-lg p-2 text-[11px]">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          A supplier bill is overdue. Nobody will sell you on terms until it is settled — cash orders
          are still fine.
        </p>
      )}

      {/* ---- What, and is it cheap today ---- */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Product</Label>
          <Select value={product?.name ?? ''} onValueChange={setProductName}>
            <SelectTrigger className="mt-1 h-9 text-xs">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {data.products.map(p => (
                <SelectItem key={p.name} value={p.name} className="text-xs">
                  {p.icon} {p.name}
                  {p.perishable ? ` · keeps ${p.shelfLifeDays}d` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="sq" className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Quantity
          </Label>
          <Input
            id="sq"
            type="number"
            min={1}
            value={quantity}
            disabled={busy}
            className="mt-1 h-9 text-xs"
            onChange={e => setQuantity(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
      </div>

      {product && (
        <div className="bt-surface mt-2 flex flex-wrap items-center gap-2 p-2 text-[11px]">
          <span className="text-muted-foreground">Market today</span>
          <span className="bt-numeric font-semibold">{formatTaka(product.marketUnitCost)}</span>
          {product.cheapToday && (
            <Badge variant="outline" className="bt-tone bt-tone-emerald gap-1 rounded-full px-2 text-[10px]">
              <TrendingDown className="h-2.5 w-2.5" aria-hidden="true" />
              cheap this week — worth buying ahead
            </Badge>
          )}
          {product.dearToday && (
            <Badge variant="outline" className="bt-tone bt-tone-crimson gap-1 rounded-full px-2 text-[10px]">
              <TrendingUp className="h-2.5 w-2.5" aria-hidden="true" />
              dear this week
            </Badge>
          )}
          {product.perishable && (
            <Badge variant="outline" className="bt-tone bt-tone-amber rounded-full px-2 text-[10px]">
              keeps {product.shelfLifeDays} day{product.shelfLifeDays === 1 ? '' : 's'}
            </Badge>
          )}
        </div>
      )}

      {/* ---- Who ---- */}
      <div className="mt-3 space-y-2">
        {data.suppliers.map(option => {
          const chosen = option.id === supplierId;
          const risky = (option.survival?.lossShare ?? 0) > 0.25;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setSupplierId(option.id);
                if (!option.terms.some(t => t.id === term)) setTerm('NET_0');
              }}
              className={cn(
                'bt-surface w-full rounded-lg p-2.5 text-left transition',
                chosen ? 'bt-edge bt-edge-gold' : 'hover:brightness-105',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span aria-hidden="true">{option.icon}</span>
                <span className="text-xs font-semibold">{option.en}</span>
                <span className="bt-numeric text-[10px] text-muted-foreground">
                  {option.leadDays}d lead · min {option.minQuantity}
                </span>
                {option.quote && (
                  <span className="bt-numeric ml-auto text-xs font-bold">
                    {formatTaka(option.quote.totalCost)}
                  </span>
                )}
              </div>

              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{option.note}</p>

              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {option.quote && option.quote.bulkDiscount > 0 && (
                  <Badge variant="outline" className="bt-tone bt-tone-emerald rounded-full px-2 text-[9px]">
                    {Math.round(option.quote.bulkDiscount * 100)}% bulk
                  </Badge>
                )}
                {option.quote && option.quote.savingVsCounter > 0 && (
                  <span className="bt-numeric text-[9px] bt-text-profit">
                    saves {formatTaka(option.quote.savingVsCounter)} vs the counter
                  </span>
                )}
                {/* The thing that stops "order 800 fish from the importer". */}
                {risky && option.survival && (
                  <Badge variant="outline" className="bt-tone bt-tone-crimson rounded-full px-2 text-[9px]">
                    ~{Math.round(option.survival.lossShare * 100)}% would spoil before it sells
                  </Badge>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ---- On what terms, and when ---- */}
      {supplier && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Payment</Label>
            <Select value={term} onValueChange={setTerm}>
              <SelectTrigger className="mt-1 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supplier.terms.map(t => (
                  <SelectItem
                    key={t.id}
                    value={t.id}
                    className="text-xs"
                    disabled={t.days > 0 && data.credit.blocked}
                  >
                    {t.en}
                    {t.surcharge > 0 ? ` (+${Math.round(t.surcharge * 100)}%)` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="when" className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Arrives day {deliveryDay}
              {extraDays > 0 ? ` (${extraDays} days later than needed)` : ''}
            </Label>
            <Input
              id="when"
              type="range"
              min={0}
              max={30}
              value={extraDays}
              disabled={busy}
              className="mt-2 h-9 cursor-pointer"
              onChange={e => setExtraDays(Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {supplier?.quote && (
        <div className="bt-surface mt-2 space-y-1 p-3 text-[11px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Goods</span>
            <span className="bt-numeric">{formatTaka(supplier.quote.goodsValue)}</span>
          </div>
          {supplier.quote.creditSurcharge > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cost of credit</span>
              <span className="bt-numeric">{formatTaka(supplier.quote.creditSurcharge)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-[var(--bt-hairline)] pt-1 font-semibold">
            <span>{term === 'NET_0' ? 'Payable now' : `Payable day ${supplier.quote.dueOnDay}`}</span>
            <span className="bt-numeric">{formatTaka(supplier.quote.totalCost)}</span>
          </div>
        </div>
      )}

      <Button
        className="mt-3 w-full"
        disabled={busy || !product || !supplier || belowMinimum || !termOffered}
        onClick={place}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
        {belowMinimum && supplier
          ? `${supplier.en} needs at least ${supplier.minQuantity}`
          : 'Place order'}
      </Button>
    </div>
  );
}
