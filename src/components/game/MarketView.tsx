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

export default function MarketView() {
  const { selectedCity, setSelectedCity, businesses } = useGameStore();
  const [products, setProducts] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const fetchProducts = async (city: string, type: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ city });
      if (type !== 'all') params.set('type', type);
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
        <h2 className="text-lg font-bold flex items-center gap-2">
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
            const trend = getPriceTrend(p.marketPrice || 0, p.basePrice || 0);
            const demand = p.demand || 1;
            const bt = getBusinessType(p.category);
            return (
              <motion.div
                key={p.productId || p.name}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="game-card-hover">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl shrink-0">{p.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{p.name}</span>
                          {bt && <Badge variant="outline" className="text-[10px] shrink-0">{bt.icon} {bt.name}</Badge>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`text-[10px] border ${getDemandColor(demand)}`} variant="outline">
                            {getDemandLabel(demand)} demand
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            Base: ৳{(p.basePrice || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold">৳{(p.marketPrice || 0).toLocaleString()}</div>
                        <div className={`flex items-center justify-end gap-0.5 text-xs ${
                          trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
                        }`}>
                          {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : trend === 'down' ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                          {trend === 'up' ? 'Rising' : trend === 'down' ? 'Falling' : 'Stable'}
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
