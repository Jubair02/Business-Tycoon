'use client';

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Check, Heart, MessageSquare, Star, ThumbsDown, ThumbsUp, TrendingDown, TrendingUp, UserCircle, Users, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusinessDetail } from './context';

/**
 * Satisfaction, loyalty and what customers are saying.
 *
 * Split out of `BusinessDetail.tsx`, which had grown to 1,729 lines — long
 * past the point where the panel you were editing could be found, let alone
 * reviewed. The markup is unchanged; only its home is.
 */
export default function CxTab() {
  const {
    cxData,
    cxLoading,
  } = useBusinessDetail();

  return (
    <>
      <div className="space-y-3">
        {cxLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
          </div>
        ) : !cxData ? (
          <div className="h-32 flex items-center justify-center">
            <div className="text-center">
              <Heart className="h-8 w-8 text-muted-foreground/30 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">No customer data yet. Advance days to generate data.</p>
            </div>
          </div>
        ) : (
          <>
            {/* CX Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="border-l-4 border-l-emerald-500 game-stat-card">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Heart className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                    <div className="text-xs text-muted-foreground uppercase" style={{ letterSpacing: '0.08em' }}>Satisfaction</div>
                  </div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{Math.round(cxData.summary.satisfactionScore)}%</div>
                  <Progress value={cxData.summary.satisfactionScore} className="h-1.5 mt-1" />
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-rose-500 game-stat-card">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Users className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />
                    <div className="text-xs text-muted-foreground uppercase" style={{ letterSpacing: '0.08em' }}>Loyalty</div>
                  </div>
                  <div className="text-lg font-bold text-rose-600 dark:text-rose-400">{Math.round(cxData.summary.loyaltyScore)}%</div>
                  <Progress value={cxData.summary.loyaltyScore} className="h-1.5 mt-1" />
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-sky-500 game-stat-card">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <UserCircle className="h-3.5 w-3.5 text-sky-500 dark:text-sky-400" />
                    <div className="text-xs text-muted-foreground uppercase" style={{ letterSpacing: '0.08em' }}>Repeat Rate</div>
                  </div>
                  <div className="text-lg font-bold text-sky-600 dark:text-sky-400">{(cxData.summary.repeatCustomerRate * 100).toFixed(1)}%</div>
                  <Progress value={cxData.summary.repeatCustomerRate * 100} className="h-1.5 mt-1" />
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-violet-500 game-stat-card">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp className="h-3.5 w-3.5 text-violet-500 dark:text-violet-400" />
                    <div className="text-xs text-muted-foreground uppercase" style={{ letterSpacing: '0.08em' }}>NPS Score</div>
                  </div>
                  <div className={`text-lg font-bold ${cxData.summary.npsScore >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-red-500 dark:text-red-400'}`}>
                    {Math.round(cxData.summary.npsScore)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {cxData.summary.npsScore >= 50 ? 'Excellent' : cxData.summary.npsScore >= 20 ? 'Good' : cxData.summary.npsScore >= 0 ? 'Okay' : 'Needs Work'}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Satisfaction Trend */}
            {cxData.summary.satisfactionTrend !== 0 && (
              <div className={`text-xs flex items-center gap-1 ${cxData.summary.satisfactionTrend > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {cxData.summary.satisfactionTrend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                Satisfaction {cxData.summary.satisfactionTrend > 0 ? 'trending up' : 'trending down'} ({cxData.summary.satisfactionTrend > 0 ? '+' : ''}{cxData.summary.satisfactionTrend.toFixed(1)})
              </div>
            )}

            {/* Customer Segments */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Customer Segments
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(cxData.segments).map(([key, seg]: [string, any]) => {
                    const icons: Record<string, string> = { BUDGET: '💰', REGULAR: '👤', PREMIUM: '✨', TOURIST: '🎒' };
                    return (
                      <div key={key} className="text-center p-2 rounded-lg bg-muted/50">
                        <div className="text-lg mb-0.5">{icons[key] || '👤'}</div>
                        <div className="text-xs font-medium">{key.charAt(0) + key.slice(1).toLowerCase()}</div>
                        <div className="text-xs font-bold">{(seg.share * 100).toFixed(0)}%</div>
                        <div className="text-xs text-muted-foreground">{seg.count} reviews</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Positive & Negative Factors */}
            <div className="grid grid-cols-2 gap-3">
              {cxData.positiveFactors.length > 0 && (
                <Card className="border-l-4 border-l-emerald-400">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1 mb-1.5">
                      <ThumbsUp className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                      <div className="text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-400" style={{ letterSpacing: '0.08em' }}>Strengths</div>
                    </div>
                    <div className="space-y-1">
                      {cxData.positiveFactors.map((f: string, i: number) => (
                        <div key={i} className="text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-1">
                          <Check className="h-3 w-3 mt-0.5 shrink-0" /> {f}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {cxData.negativeFactors.length > 0 && (
                <Card className="border-l-4 border-l-red-400">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1 mb-1.5">
                      <ThumbsDown className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
                      <div className="text-xs font-semibold uppercase text-red-600 dark:text-red-400" style={{ letterSpacing: '0.08em' }}>Issues</div>
                    </div>
                    <div className="space-y-1">
                      {cxData.negativeFactors.map((f: string, i: number) => (
                        <div key={i} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1">
                          <X className="h-3 w-3 mt-0.5 shrink-0" /> {f}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Review Stats */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5" /> Reviews ({cxData.reviews.total || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                {cxData.reviews.total > 0 ? (
                  <>
                    {/* Rating Distribution */}
                    <div className="space-y-1 mb-3">
                      {[5,4,3,2,1].map(stars => {
                        const count = cxData.reviews.distribution[stars] || 0;
                        const total = cxData.reviews.total || 1;
                        return (
                          <div key={stars} className="flex items-center gap-2 text-xs">
                            <span className="w-3 text-right">{stars}</span>
                            <Star className="h-3 w-3 text-amber-400 dark:text-amber-300 fill-amber-400" />
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(count / total) * 100}%` }} />
                            </div>
                            <span className="w-6 text-right text-muted-foreground">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                    {/* Sentiment Summary */}
                    <div className="flex gap-3 text-xs">
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <ThumbsUp className="h-3 w-3" /> {cxData.reviews.sentimentCounts.POSITIVE || 0}
                      </span>
                      <span className="text-muted-foreground">
                        😐 {cxData.reviews.sentimentCounts.NEUTRAL || 0}
                      </span>
                      <span className="flex items-center gap-1 text-red-500 dark:text-red-400">
                        <ThumbsDown className="h-3 w-3" /> {cxData.reviews.sentimentCounts.NEGATIVE || 0}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No reviews yet. Advance days to generate reviews.</p>
                )}
              </CardContent>
            </Card>

            {/* Recent Reviews */}
            {cxData.reviews.recent && cxData.reviews.recent.length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> Recent Reviews
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <ScrollArea className="max-h-48">
                    <div className="space-y-2">
                      {cxData.reviews.recent.slice(0, 10).map((review: any, i: number) => {
                        const sentimentColors: Record<string, string> = {
                          POSITIVE: 'border-l-emerald-400',
                          NEUTRAL: 'border-l-amber-400',
                          NEGATIVE: 'border-l-red-400',
                        };
                        const segmentIcons: Record<string, string> = {
                          BUDGET: '💰', REGULAR: '👤', PREMIUM: '✨', TOURIST: '🎒',
                        };
                        return (
                          <div key={i} className={`border-l-2 ${sentimentColors[review.sentiment] || 'border-l-gray-300'} pl-2 py-1`}>
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="text-xs">{segmentIcons[review.segment] || '👤'}</span>
                              <div className="flex">
                                {Array.from({ length: 5 }).map((_, s) => (
                                  <Star key={s} className={`h-2.5 w-2.5 ${s < review.rating ? 'text-amber-400 dark:text-amber-300 fill-amber-400' : 'text-gray-300'}`} />
                                ))}
                              </div>
                              <span className="text-xs text-muted-foreground ml-auto">Day {review.gameDay}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{review.comment}</p>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* CX Trends Chart */}
            {cxData.trends.satisfaction && cxData.trends.satisfaction.length > 1 && (
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-xs font-semibold">CX Trends</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={cxData.trends.satisfaction.map((s: any, i: number) => ({
                      day: s.day,
                      satisfaction: s.value,
                      loyalty: cxData.trends.loyalty[i]?.value || 0,
                      nps: cxData.trends.nps[i]?.value || 0,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                      <Line type="monotone" dataKey="satisfaction" stroke="#10b981" strokeWidth={2} dot={false} name="Satisfaction" />
                      <Line type="monotone" dataKey="loyalty" stroke="#f43f5e" strokeWidth={2} dot={false} name="Loyalty" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
