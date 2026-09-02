'use client';

import { useGameStore } from '@/store/game-store';
import { formatTakaShort, getBusinessType, getCity } from '@/lib/game-data';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp, TrendingDown, Building2, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function BusinessList() {
  const { businesses, setView, selectBusiness } = useGameStore();

  return (
    <div className="p-3 md:p-4 space-y-5 pb-24 md:pb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}>
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="game-badge-gradient">Your Businesses</span>
          <span className="text-xs font-bold text-muted-foreground bg-muted rounded-full px-2 py-0.5">{businesses.length}</span>
        </h2>
        <Button size="sm" onClick={() => setView('new-business')} className="gap-1.5 text-white text-xs rounded-lg shadow-sm hover:shadow-md transition-shadow" style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}>
          <Plus className="h-3.5 w-3.5" /> New
        </Button>
      </div>

      {businesses.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-dashed rounded-xl">
            <CardContent className="py-14 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, rgba(0,106,78,0.08), rgba(0,168,107,0.12))' }}>
                <span className="text-4xl">🏗️</span>
              </div>
              <h3 className="font-bold text-base mb-1.5">No Businesses Yet</h3>
              <p className="text-sm text-muted-foreground font-medium mb-5 max-w-[240px] mx-auto">Create your first business to start earning profits!</p>
              <Button onClick={() => setView('new-business')} className="text-white rounded-lg shadow-sm hover:shadow-md transition-shadow" style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}>
                <Plus className="h-4 w-4 mr-1.5" /> Create Your First Business
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {businesses.map((b: any, i: number) => {
            const bt = getBusinessType(b.type);
            const city = getCity(b.city);
            const profit = b.dailyProfit || 0;
            const isPositive = profit >= 0;
            return (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
              >
                <Card className="cursor-pointer rounded-xl transition-all duration-300 hover:shadow-lg hover:border-green-200" onClick={() => selectBusiness(b.id)}>
                  <div
                    className="h-1 rounded-t-xl"
                    style={{
                      background: isPositive
                        ? 'linear-gradient(90deg, #006a4e, #00a86b)'
                        : 'linear-gradient(90deg, #f42a41, #f87171)',
                    }}
                  />
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn('text-3xl p-2.5 rounded-xl shrink-0 shadow-sm', bt?.bgColor || 'bg-gray-50')}>
                        {bt?.icon || '🏪'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">{b.name}</div>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground font-medium">
                          <MapPin className="h-3 w-3" />
                          {city?.name} <span className="text-border">·</span> {bt?.name}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          <Badge variant="secondary" className="text-[10px] px-2 py-0 rounded-full font-semibold bg-green-50 text-green-700">
                            Lv.{b.level || 1}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] px-2 py-0 rounded-full font-medium">
                            {b._count?.inventories || 0} items
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] px-2 py-0 rounded-full font-medium">
                            {b._count?.employees || 0} staff
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <hr className="game-divider-gradient my-3" />
                    <div className="space-y-2.5">
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">
                          <span>Reputation</span>
                          <span className="normal-case">{b.reputation || 0}%</span>
                        </div>
                        <Progress value={b.reputation || 0} className="h-1.5 rounded-full" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium">Daily Profit</span>
                        <span className={cn(
                          'text-sm font-bold flex items-center gap-1 px-2 py-0.5 rounded-lg',
                          isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                        )}>
                          {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          {isPositive ? '+' : ''}{formatTakaShort(profit)}
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
