'use client';

import { useGameStore } from '@/store/game-store';
import { formatTakaShort, getBusinessType, getCity } from '@/lib/game-data';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';

export default function BusinessList() {
  const { businesses, setView, selectBusiness } = useGameStore();

  return (
    <div className="p-3 md:p-4 space-y-4 pb-24 md:pb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Your Businesses ({businesses.length})</h2>
        <Button size="sm" onClick={() => setView('new-business')} className="gap-1 text-white text-xs" style={{ background: '#006a4e' }}>
          <Plus className="h-3.5 w-3.5" /> New Business
        </Button>
      </div>

      {businesses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="text-5xl mb-3">🏗️</div>
            <h3 className="font-semibold mb-1">No Businesses Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first business to start earning!</p>
            <Button onClick={() => setView('new-business')} className="text-white" style={{ background: '#006a4e' }}>
              <Plus className="h-4 w-4 mr-1" /> Create Business
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {businesses.map((b: any, i: number) => {
            const bt = getBusinessType(b.type);
            const city = getCity(b.city);
            const profit = b.dailyProfit || 0;
            return (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="game-card-interactive" onClick={() => selectBusiness(b.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`text-3xl p-2.5 rounded-xl ${bt?.bgColor || 'bg-gray-50'}`}>
                        {bt?.icon || '🏪'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{b.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {bt?.name} · {city?.name}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Lv.{b.level || 1}</Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {b.inventoryCount || 0} items
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {b.employeeCount || 0} staff
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Reputation</span>
                          <span>{b.reputation || 0}%</span>
                        </div>
                        <Progress value={b.reputation || 0} className="h-1.5" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Daily Profit</span>
                        <span className={`text-sm font-bold flex items-center gap-0.5 ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {profit >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {profit >= 0 ? '+' : ''}{formatTakaShort(profit)}
                        </span>
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