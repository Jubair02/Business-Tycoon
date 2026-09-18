'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Lock, Sparkles, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { takaFromMinor, type CatalogueItem } from '@/lib/commerce/catalogue';
import type { PassTier } from '@/lib/commerce/season-pass';

interface StoreData {
  catalogue: CatalogueItem[];
  passTrack: PassTier[];
  owned: { sku: string; source: string }[];
  prestige: number;
  provider: string;
  adsEnabled: boolean;
  season: { number: number; name: string } | null;
  pass: {
    premium: boolean;
    claimedTiers: number[];
    xp: number;
    tier: number;
    maxTier: number;
    tierProgress: number;
    complete: boolean;
  } | null;
}

export default function StoreView() {
  const { taka } = useI18n();
  const [data, setData] = useState<StoreData | null>(null);
  const [busySku, setBusySku] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/commerce/store');
      if (res.ok) setData(await res.json());
    } catch {
      // Leave the skeleton up; the store is not load-bearing.
    }
  }, []);

  useEffect(() => {
    // Started off a resolved promise so nothing `load` does can write state
    // during the effect body itself — the cascading-render pattern React 19
    // flags, and the same shape used elsewhere in this codebase.
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) return load();
    });
    return () => { cancelled = true; };
  }, [load]);

  const buy = async (sku: string) => {
    setBusySku(sku);
    try {
      const res = await fetch('/api/commerce/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, idempotencyKey: crypto.randomUUID() }),
      });
      const body = await res.json();

      if (!res.ok) {
        toast.error(body?.error?.message ?? 'That purchase could not be completed.');
        return;
      }
      if (body.redirectUrl) {
        // `assign` rather than writing `location.href`: the React compiler
        // treats assigning to a property of a module-scope binding as a
        // mutation it cannot reason about, and this is a navigation either way.
        window.location.assign(body.redirectUrl);
        return;
      }
      toast.success('Added to your account.');
      await load();
    } catch {
      toast.error('Network error.');
    } finally {
      setBusySku(null);
    }
  };

  const claim = async (tier: number, track: 'free' | 'premium') => {
    setBusySku(`tier-${tier}-${track}`);
    try {
      const res = await fetch('/api/commerce/pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, track }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error?.message ?? 'That reward could not be claimed.');
        return;
      }
      toast.success('Reward claimed.');
      await load();
    } catch {
      toast.error('Network error.');
    } finally {
      setBusySku(null);
    }
  };

  if (!data) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const owned = new Set(data.owned.map(o => o.sku));
  const claimed = new Set(data.pass?.claimedTiers ?? []);
  const cosmetics = data.catalogue.filter(i => i.kind === 'COSMETIC');
  const convenience = data.catalogue.filter(i => i.kind === 'CONVENIENCE');
  const passItem = data.catalogue.find(i => i.kind === 'PASS');

  return (
    <div className="space-y-3 p-3 md:p-4">
      {/* The rule, said to the player rather than only to the codebase. */}
      <div className="bt-tone bt-tone-emerald flex items-start gap-2.5 rounded-xl p-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="text-xs leading-relaxed">
          Everything here is cosmetic or a shortcut for your own time. Nothing sold changes what a
          shop earns, what it costs to run, or where you finish the season.
        </p>
      </div>

      {/* ---- Season pass ---- */}
      {data.season && data.pass && (
        <Card className="game-gradient-card">
          <CardHeader className="px-4 pb-2 pt-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Ticket className="h-4 w-4 text-[var(--bt-emerald)]" aria-hidden="true" />
              {data.season.name}
            </CardTitle>
            <CardDescription className="text-xs">
              Tier {data.pass.tier} of {data.pass.maxTier}
              {data.pass.premium ? ' · premium track unlocked' : ' · free track'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 px-4 pb-4">
            <Progress value={data.pass.tierProgress * 100} className="h-1" />

            {!data.pass.premium && passItem && (
              <Button
                size="sm"
                className="w-full text-white"
                style={{ background: '#006a4e' }}
                disabled={busySku === passItem.sku}
                onClick={() => buy(passItem.sku)}
              >
                Unlock premium track — {taka(takaFromMinor(passItem.priceMinor))}
              </Button>
            )}

            <div className="space-y-1.5">
              {data.passTrack.map(tier => {
                const reached = data.pass!.tier >= tier.tier;
                return (
                  <div
                    key={tier.tier}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border border-[var(--bt-hairline)] p-2',
                      !reached && 'opacity-50',
                    )}
                  >
                    <span className="bt-numeric w-6 shrink-0 text-center text-xs font-bold">{tier.tier}</span>

                    {(['free', 'premium'] as const).map(track => {
                      const reward = track === 'free' ? tier.free : tier.premium;
                      if (!reward) return <div key={track} className="flex-1" />;

                      const key = track === 'premium' ? tier.tier + 1000 : tier.tier;
                      const isClaimed = claimed.has(key);
                      const locked = track === 'premium' && !data.pass!.premium;

                      return (
                        <div key={track} className="flex flex-1 items-center gap-1.5">
                          <span aria-hidden="true">{reward.icon}</span>
                          <span className="min-w-0 flex-1 truncate text-[11px]">{reward.label}</span>
                          {isClaimed ? (
                            <Check className="h-3.5 w-3.5 shrink-0 text-[var(--bt-emerald)]" aria-label="Claimed" />
                          ) : locked ? (
                            <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Premium only" />
                          ) : reached ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 shrink-0 px-2 text-[10px]"
                              disabled={busySku === `tier-${tier.tier}-${track}`}
                              onClick={() => claim(tier.tier, track)}
                            >
                              Claim
                            </Button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- Cosmetics and convenience ---- */}
      {[
        { title: 'Cosmetics', items: cosmetics },
        { title: 'Convenience', items: convenience },
      ].map(section => (
        <Card key={section.title} className="game-shine">
          <CardHeader className="px-4 pb-2 pt-4">
            <CardTitle className="text-sm font-semibold">{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4">
            {section.items.map(item => {
              const isOwned = owned.has(item.sku);
              const lockedByPrestige =
                item.requiresPrestige !== undefined && data.prestige < item.requiresPrestige;
              const earnedNotSold = item.priceMinor <= 0;

              return (
                <div
                  key={item.sku}
                  className="flex items-start gap-2.5 rounded-lg border border-[var(--bt-hairline)] p-2.5"
                >
                  <span aria-hidden="true" className="text-lg">{item.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {isOwned ? (
                      <Badge variant="outline" className="bt-tone bt-tone-emerald rounded-full px-2 text-[10px]">
                        Owned
                      </Badge>
                    ) : lockedByPrestige ? (
                      <Badge variant="outline" className="rounded-full px-2 text-[10px]">
                        Prestige {item.requiresPrestige}
                      </Badge>
                    ) : earnedNotSold ? (
                      <Badge variant="outline" className="rounded-full px-2 text-[10px]">Earned</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={busySku === item.sku}
                        onClick={() => buy(item.sku)}
                      >
                        {taka(takaFromMinor(item.priceMinor))}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {data.provider === 'sandbox' && (
        <p className="px-1 text-[11px] text-muted-foreground">
          Payments are in sandbox mode: purchases settle instantly and nothing is charged.
        </p>
      )}
    </div>
  );
}
