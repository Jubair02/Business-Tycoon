'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatTaka } from '@/lib/game-data';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  TrendingUp, TrendingDown, BarChart3, Users, Package, ArrowUp,
  Zap, PackageOpen, Clock, BellOff, CheckCheck, Bell,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface LogEntry {
  id: string;
  type: string;
  message: string;
  amount: number | null;
  createdAt: string;
}

interface NotificationCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LOG_ICON_MAP: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  REVENUE:  { icon: TrendingUp,  color: 'text-green-600', bg: 'bg-green-100' },
  EXPENSE:  { icon: TrendingDown, color: 'text-red-500',   bg: 'bg-red-100' },
  PROFIT:   { icon: BarChart3,   color: 'text-emerald-600', bg: 'bg-emerald-100' },
  HIRE:     { icon: Users,       color: 'text-blue-600',   bg: 'bg-blue-100' },
  PURCHASE: { icon: Package,     color: 'text-amber-600',  bg: 'bg-amber-100' },
  UPGRADE:  { icon: ArrowUp,     color: 'text-purple-600', bg: 'bg-purple-100' },
  EVENT:    { icon: Zap,         color: 'text-orange-500', bg: 'bg-orange-100' },
  SELL:     { icon: PackageOpen, color: 'text-amber-600',  bg: 'bg-amber-100' },
};

const DEFAULT_ICON: { icon: LucideIcon; color: string; bg: string } = {
  icon: Clock, color: 'text-muted-foreground', bg: 'bg-gray-100',
};

function getLogConfig(type: string) {
  return LOG_ICON_MAP[type] || DEFAULT_ICON;
}

function formatLogTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 1) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMins = Math.floor(diffSec / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return `${Math.floor(diffHrs / 24)}d ago`;
  } catch {
    return '';
  }
}

function isNewLog(dateStr: string): boolean {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    return (now.getTime() - d.getTime()) < 30000;
  } catch {
    return false;
  }
}

const listItemVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.03, duration: 0.25, ease: 'easeOut' },
  }),
  exit: { opacity: 0, x: 20, transition: { duration: 0.15 } },
};

export default function NotificationCenter({ open, onOpenChange }: NotificationCenterProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/player/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(Array.isArray(data) ? data.slice(0, 20) : []);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      const doFetch = async () => {
        setLoading(true);
        try {
          const res = await fetch('/api/player/logs');
          if (res.ok) {
            const data = await res.json();
            setLogs(Array.isArray(data) ? data.slice(0, 20) : []);
          }
        } catch {
          // silent
        }
        setLoading(false);
      };
      doFetch();
    }
  }, [open]);

  const handleMarkAllRead = () => {
    setLogs((prev) =>
      prev.map((log) => ({ ...log, _read: true } as LogEntry & { _read?: boolean }))
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 pb-0 shrink-0">
          <div className="flex items-center justify-between pr-6">
            <SheetTitle className="flex items-center gap-2 text-base">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #006a4e, #00a86b)' }}
              >
                <Bell className="h-4 w-4 text-white" />
              </div>
              Notifications
            </SheetTitle>
            {logs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1 text-green-700 hover:text-green-800 hover:bg-green-50"
                onClick={handleMarkAllRead}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Recent game activity and events
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 px-4 pb-4 pt-2">
          {loading ? (
            <div className="space-y-2.5 mt-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div
                className="h-16 w-16 rounded-full flex items-center justify-center mb-3"
                style={{ background: 'linear-gradient(135deg, rgba(0,106,78,0.1), rgba(0,168,107,0.1))' }}
              >
                <BellOff className="h-7 w-7" style={{ color: '#006a4e' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: '#006a4e' }}>
                No recent activity
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Game events and logs will appear here
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-12rem)] max-h-[600px]">
              <AnimatePresence mode="popLayout">
                <div className="space-y-1">
                  {logs.map((log, i) => {
                    const config = getLogConfig(log.type);
                    const IconComp = config.icon;
                    const fresh = isNewLog(log.createdAt);
                    return (
                      <motion.div
                        key={log.id}
                        custom={i}
                        variants={listItemVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        layout
                        className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors ${
                          fresh
                            ? 'bg-green-50/70 border border-green-200/50'
                            : i % 2 === 0
                              ? 'bg-muted/30'
                              : ''
                        }`}
                      >
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${config.bg}`}>
                          <IconComp className={`h-4 w-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs leading-relaxed pr-2">
                            {log.message}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">
                              {formatLogTime(log.createdAt)}
                            </span>
                            {log.amount !== null && log.amount !== undefined && (
                              <span
                                className={`text-[10px] font-semibold ml-1 px-1.5 py-0.5 rounded-full ${
                                  log.amount >= 0
                                    ? 'text-green-700 bg-green-100'
                                    : 'text-red-600 bg-red-100'
                                }`}
                              >
                                {log.amount >= 0 ? '+' : ''}
                                {formatTaka(log.amount)}
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </AnimatePresence>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
