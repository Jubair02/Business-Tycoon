'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { formatTaka, CITIES, BUSINESS_TYPES, getCity, getBusinessType } from '@/lib/game-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';

// Generate a deterministic mini sparkline from a seed string
const getSparklineBars = (seed: string): number[] => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < 7; i++) {
    hash = ((hash << 3) ^ (hash >>> 2)) & 0x7fffffff;
    bars.push(20 + (hash % 60));
  }
  return bars;
};

export default function MarketView() {
  const { selectedCity, setSelectedCity, businesses } = useGameStore();
  const [products, setProducts] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const fetchProducts = async (city: string, type: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ city, type });
      const res = await fetch(`/api/market/products?${params}`);
      if (res.ok) {
        setProducts(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(selectedCity, selectedType);
  }, [selectedCity, selectedType]);

  const getDemandColor = (demand: number) => {
    if (demand >= 1.2) return 'text-green-600 bg-green-50 border-green-200';
    if (demand >= 0.8) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-500 bg-red-50 border-red-200';
  };

  const getDemandDotColor = (demand: number) => {
    if (demand >= 1.2) return 'bg-green-500';
    if (demand >= 0.8) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getDemandLabel = (demand: number) => {
    if (demand >= 1.2) return 'High';
    if (demand >= 0.8) return 'Medium';
    return 'Low';
  };

  const getPriceTrend = (price: number, basePrice: number) => {
    if (!basePrice) return 'neutral';
    const diff = (price - basePrice) / basePrice;
    if (diff > 0.1) return 'up';
    if (diff < -0.1) return 'down';
    return 'stable';
  };

  const getPlayerCities = () => {
    const cityIds = [...new Set(businesses.map((b: any) => b.city))];
    if (cityIds.length > 0) return cityIds;
    return [selectedCity];
  };

  return (
    <div className="p-3 md:p-4 space-y-4 pb-24 md:pb-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold flex items-center gap-2 game-gradient-text">
          <BarChart3 className="h-5 w-5" style={{ color: '#006a4e' }} /> Market Prices
        </h2>
      </div>

      <div className="flex gap-2">
        <Select value={selectedCity} onValueChange={setSelectedCity}>
          <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CITIES.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-[140px] md:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {BUSINESS_TYPES.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.icon} {b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing prices for {getCity(selectedCity)?.name}. Demand is affected by active events.
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="text-4xl mb-2">📊</div>
            <p className="text-sm text-muted-foreground">No market data available for this selection.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {products.map((p: any, i: number) => {
            const trend = getPriceTrend(p.currentPrice || 0, p.basePrice || 0);
            const demand = p.currentDemand || 1;
            const bt = getBusinessType(p.category);
            const sparkBars = getSparklineBars(p.id || p.name);
            return (
              <motion.div
                key={p.id || p.name}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="game-card-hover game-shine">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl shrink-0">{p.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{p.name}</span>
                          {bt && <Badge variant="outline" className="text-[10px] shrink-0">{bt.icon} {bt.name}</Badge>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full inline-block ${getDemandDotColor(demand)}`} />
                            <Badge className={`text-[10px] border ${getDemandColor(demand)}`} variant="outline">
                              {getDemandLabel(demand)} demand
                            </Badge>
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Base: ৳{(p.basePrice || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-3">
                        {/* Mini sparkline CSS-only bar chart */}
                        <div className="hidden sm:flex items-end gap-[2px] h-6" aria-hidden="true">
                          {sparkBars.map((h, bi) => (
                            <div
                              key={bi}
                              className="game-sparkline-bar"
                              style={{
                                height: `${h}%`,
                                background: trend === 'up'
                                  ? 'rgba(0, 106, 78, 0.35)'
                                  : trend === 'down'
                                  ? 'rgba(244, 42, 65, 0.3)'
                                  : 'rgba(0, 106, 78, 0.18)',
                              }}
                            />
                          ))}
                        </div>
                        <div>
                          <div className="text-sm font-bold">৳{(p.currentPrice || 0).toLocaleString()}</div>
                          <div className={`flex items-center justify-end gap-0.5 text-xs ${
                            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
                          }`}>
                            {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : trend === 'down' ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                            {trend === 'up' ? 'Rising' : trend === 'down' ? 'Falling' : 'Stable'}
                          </div>
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
  );
}
