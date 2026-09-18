'use client';

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, BarChart3, Clock, DollarSign, ShoppingCart, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { formatTaka, formatTakaShort } from '@/lib/game-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusinessDetail } from './context';

/**
 * Performance history, health, product mix and return on the investment.
 *
 * Split out of `BusinessDetail.tsx`, which had grown to 1,729 lines — long
 * past the point where the panel you were editing could be found, let alone
 * reviewed. The markup is unchanged; only its home is.
 */
export default function AnalyticsTab() {
  const {
    analyticsData,
    analyticsLoading,
    bt,
    expenses,
    fetchAnalytics,
    profit,
    revenue,
  } = useBusinessDetail();

  return (
    <>
      <div className="space-y-4">
        {analyticsLoading && !analyticsData ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : !analyticsData ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No analytics data available yet.</p>
              <Button size="sm" variant="outline" className="mt-2 text-xs" onClick={fetchAnalytics}>Load Analytics</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ---- Health Score ---- */}
            <Card className={`border-2 ${
              analyticsData.health?.score >= 80 ? 'border-green-400 dark:border-green-700/70 bg-gradient-to-br from-green-50/60 to-[var(--bt-surface-1)]' :
              analyticsData.health?.score >= 60 ? 'border-emerald-400 dark:border-emerald-700/70 bg-gradient-to-br from-emerald-50/60 to-[var(--bt-surface-1)]' :
              analyticsData.health?.score >= 40 ? 'border-amber-400 dark:border-amber-700/70 bg-gradient-to-br from-amber-50/60 to-[var(--bt-surface-1)]' :
              analyticsData.health?.score >= 20 ? 'border-orange-400 dark:border-orange-700/70 bg-gradient-to-br from-orange-50/60 to-[var(--bt-surface-1)]' :
              'border-red-400 dark:border-red-700/70 bg-gradient-to-br from-red-50/60 to-[var(--bt-surface-1)]'
            }`}>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Activity className="h-4 w-4" /> Business Health Score
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex items-center gap-4">
                  <div className={`text-4xl font-bold ${
                    analyticsData.health?.score >= 80 ? 'text-green-600 dark:text-green-400' :
                    analyticsData.health?.score >= 60 ? 'text-emerald-600 dark:text-emerald-400' :
                    analyticsData.health?.score >= 40 ? 'text-amber-600 dark:text-amber-400' :
                    analyticsData.health?.score >= 20 ? 'text-orange-600 dark:text-orange-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {analyticsData.health?.score ?? 0}
                  </div>
                  <div className="flex-1">
                    <Progress
                      value={analyticsData.health?.score ?? 0}
                      className="h-3"
                    />
                    <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                      <span>Critical</span><span>Struggling</span><span>Attention</span><span>Healthy</span><span>Excellent</span>
                    </div>
                    <Badge className={`mt-2 text-xs ${
                      analyticsData.health?.score >= 80 ? 'bg-green-600 dark:bg-green-600' :
                      analyticsData.health?.score >= 60 ? 'bg-emerald-600 dark:bg-emerald-600' :
                      analyticsData.health?.score >= 40 ? 'bg-amber-500 dark:bg-amber-500' :
                      analyticsData.health?.score >= 20 ? 'bg-orange-500 dark:bg-orange-500' :
                      'bg-red-600 dark:bg-red-600'
                    } text-white`}>
                      {analyticsData.health?.status?.replace('_', ' ') || 'Unknown'}
                    </Badge>
                  </div>
                </div>
                {/* Factors */}
                {analyticsData.health && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {analyticsData.health.positiveFactors?.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-green-700 dark:text-green-300 uppercase" style={{ letterSpacing: '0.05em' }}>✅ Strengths</div>
                        {analyticsData.health.positiveFactors.map((f: string, i: number) => (
                          <div key={i} className="text-xs text-muted-foreground">• {f}</div>
                        ))}
                      </div>
                    )}
                    {analyticsData.health.negativeFactors?.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-red-700 dark:text-red-300 uppercase" style={{ letterSpacing: '0.05em' }}>⚠️ Risks</div>
                        {analyticsData.health.negativeFactors.map((f: string, i: number) => (
                          <div key={i} className="text-xs text-muted-foreground">• {f}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ---- Financial Breakdown ---- */}
            <Card className="game-gradient-card game-shine">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold game-gradient-text flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4" /> Financial Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {(() => {
                  const fb = analyticsData.financialBreakdown;
                  if (!fb) return <div className="text-xs text-muted-foreground">No breakdown data</div>;
                  return (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="text-muted-foreground">Revenue</span>
                        </div>
                        <span className="font-medium text-green-600 dark:text-green-400">+{formatTakaShort(fb.revenue)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-red-400 dark:text-red-300" />
                          <span className="text-muted-foreground">COGS</span>
                        </div>
                        <span className="font-medium text-red-500 dark:text-red-400">-{formatTakaShort(fb.costOfGoodsSold)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground pl-6">Gross Profit</span>
                        <span className={`font-medium ${fb.grossProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                          {fb.grossProfit >= 0 ? '+' : ''}{formatTakaShort(fb.grossProfit)}
                        </span>
                      </div>
                      <Separator />
                      {(fb.salaries > 0 || fb.rent > 0 || fb.utilities > 0 || fb.taxes > 0) && (
                        <>
                          {fb.rent > 0 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Rent</span>
                              <span className="font-medium text-red-500 dark:text-red-400">-{formatTakaShort(fb.rent)}</span>
                            </div>
                          )}
                          {fb.salaries > 0 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Salaries</span>
                              <span className="font-medium text-red-500 dark:text-red-400">-{formatTakaShort(fb.salaries)}</span>
                            </div>
                          )}
                          {fb.utilities > 0 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Utilities</span>
                              <span className="font-medium text-red-500 dark:text-red-400">-{formatTakaShort(fb.utilities)}</span>
                            </div>
                          )}
                          {fb.taxes > 0 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Taxes</span>
                              <span className="font-medium text-red-500 dark:text-red-400">-{formatTakaShort(fb.taxes)}</span>
                            </div>
                          )}
                          <Separator />
                        </>
                      )}
                      <div className="flex items-center justify-between text-sm font-bold">
                        <span>Net Profit</span>
                        <span className={fb.netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
                          {fb.netProfit >= 0 ? '+' : ''}{formatTakaShort(fb.netProfit)}
                        </span>
                      </div>
                      {fb.customers > 0 && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                          <span>Customers today</span>
                          <span className="font-medium">{fb.customers}</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* ---- ROI & Payback ---- */}
            {analyticsData.roi && (
              <Card className="game-shine">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold game-gradient-text flex items-center gap-1.5">
                    <Target className="h-4 w-4" /> ROI &amp; Payback
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-2.5 rounded-lg bg-muted/40">
                      <div className="text-xs text-muted-foreground uppercase" style={{ letterSpacing: '0.05em' }}>Total Investment</div>
                      <div className="text-sm font-bold mt-0.5">{formatTakaShort(analyticsData.roi.investment)}</div>
                    </div>
                    <div className="text-center p-2.5 rounded-lg bg-muted/40">
                      <div className="text-xs text-muted-foreground uppercase" style={{ letterSpacing: '0.05em' }}>Cumulative Profit</div>
                      <div className={`text-sm font-bold mt-0.5 ${(analyticsData.roi.cumulativeProfit || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        {formatTakaShort(analyticsData.roi.cumulativeProfit)}
                      </div>
                    </div>
                    <div className="text-center p-2.5 rounded-lg bg-muted/40">
                      <div className="text-xs text-muted-foreground uppercase" style={{ letterSpacing: '0.05em' }}>ROI</div>
                      <div className={`text-sm font-bold mt-0.5 ${(analyticsData.roi.roiPercentage || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        {(analyticsData.roi.roiPercentage || 0).toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-center p-2.5 rounded-lg bg-muted/40">
                      <div className="text-xs text-muted-foreground uppercase" style={{ letterSpacing: '0.05em' }}>Payback</div>
                      <div className="text-sm font-bold mt-0.5 flex items-center justify-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {analyticsData.roi.estimatedPaybackDays != null
                          ? `${analyticsData.roi.estimatedPaybackDays} days`
                          : '∞'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-center">
                    <div className="text-xs text-muted-foreground">Avg. Daily Profit</div>
                    <div className={`text-base font-bold ${(analyticsData.roi.averageDailyProfit || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {formatTaka(analyticsData.roi.averageDailyProfit || 0)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ---- Product Performance ---- */}
            {analyticsData.productPerformance?.length > 0 && (
              <Card className="game-shine">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold game-gradient-text flex items-center gap-1.5">
                    <ShoppingCart className="h-4 w-4" /> Product Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-2">
                    {analyticsData.productPerformance.map((pp: any, i: number) => {
                      const demandIcon = pp.demandScore === 'VERY_HIGH' ? '🔥' : pp.demandScore === 'HIGH' ? '📈' : pp.demandScore === 'NORMAL' ? '➡️' : pp.demandScore === 'LOW' ? '📉' : '❄️';
                      const demandLabel = pp.demandScore === 'VERY_HIGH' ? 'Very High' : pp.demandScore === 'HIGH' ? 'High' : pp.demandScore === 'NORMAL' ? 'Normal' : pp.demandScore === 'LOW' ? 'Low' : 'Very Low';
                      const demandColor = pp.demandScore === 'VERY_HIGH' || pp.demandScore === 'HIGH' ? 'text-green-600 dark:text-green-400' : pp.demandScore === 'NORMAL' ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400';
                      return (
                        <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg border bg-muted/20">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium truncate">{pp.productName}</span>
                              <span className={`text-xs ${demandColor}`}>{demandIcon} {demandLabel}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span>Stock: {pp.remainingStock}</span>
                              <span>Margin: {(pp.profitMargin * 100).toFixed(0)}%</span>
                              {pp.priceScore > 0 && <span>Price Score: {(pp.priceScore * 100).toFixed(0)}%</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ---- Performance History Chart (Recharts) ---- */}
            <Card className="game-shine">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold game-gradient-text flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4" /> Performance History
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {analyticsData.history?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={analyticsData.history} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="gameDay"
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        tickFormatter={(v: number) => `D${v}`}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        tickFormatter={(v: number) => {
                          if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
                          return String(v);
                        }}
                      />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                        formatter={(value: number, name: string) => [formatTakaShort(value), name.charAt(0).toUpperCase() + name.slice(1)]}
                        labelFormatter={(label: number) => `Day ${label}`}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 10 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#16a34a"
                        strokeWidth={2}
                        dot={false}
                        name="revenue"
                      />
                      <Line
                        type="monotone"
                        dataKey="expenses"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                        name="expenses"
                      />
                      <Line
                        type="monotone"
                        dataKey="profit"
                        stroke="#006a4e"
                        strokeWidth={2}
                        dot={false}
                        name="profit"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-32 flex items-center justify-center">
                    <div className="text-center">
                      <BarChart3 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">No history yet. Advance days to generate data.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
