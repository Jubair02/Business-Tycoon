'use client';

import { motion } from 'framer-motion';
import { Activity, FileText, TrendingDown, TrendingUp } from 'lucide-react';
import { formatTakaShort } from '@/lib/game-data';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusinessDetail } from './context';

/**
 * The shop's own activity log.
 *
 * Split out of `BusinessDetail.tsx`, which had grown to 1,729 lines — long
 * past the point where the panel you were editing could be found, let alone
 * reviewed. The markup is unchanged; only its home is.
 */
export default function LogsTab() {
  const {
    fetchLogs,
    logs,
    logsLoading,
  } = useBusinessDetail();

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" style={{ color: '#006a4e' }} /> Activity Log
          </h3>
          <Button size="sm" variant="outline" className="text-xs" onClick={fetchLogs}>
            Refresh
          </Button>
        </div>

        {logsLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Card key={i}><CardContent className="p-3"><Skeleton className="h-12 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <div className="text-4xl mb-2">📋</div>
              <p className="text-sm text-muted-foreground">No activity yet. The log fills in once a day has been traded.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {logs.map((log: any, i: number) => {
              const isProfit = log.type === 'PROFIT';
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card className={isProfit ? 'border-l-4 border-l-green-400 game-gradient-card' : 'border-l-4 border-l-red-400 game-gradient-card'}>
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 ${isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                          {isProfit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm">{log.message}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs font-bold ${isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                              {isProfit ? '+' : '-'}{formatTakaShort(Math.abs(log.amount || 0))}
                            </span>
                            {log.createdAt && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(log.createdAt).toLocaleDateString()}
                              </span>
                            )}
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
    </>
  );
}
