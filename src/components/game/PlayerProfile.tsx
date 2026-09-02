'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { formatTaka, formatTakaShort } from '@/lib/game-data';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Wallet,
  TrendingUp,
  Building2,
  Users,
  CalendarDays,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Clock,
  X,
} from 'lucide-react';

interface PlayerProfileProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const slideUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
};

export default function PlayerProfile({ open, onOpenChange }: PlayerProfileProps) {
  const { player, businesses, gameDay } = useGameStore();
  const [profileData, setProfileData] = useState<{
    totalRevenue: number;
    totalProfit: number;
    totalExpenses: number;
  } | null>(null);

  useEffect(() => {
    if (open && player) {
      // Compute stats from businesses in the store
      const totalRevenue = businesses.reduce(
        (sum: number, b: any) => sum + (b.dailyRevenue || 0),
        0
      );
      const totalProfit = businesses.reduce(
        (sum: number, b: any) => sum + (b.dailyProfit || 0),
        0
      );
      const totalExpenses = businesses.reduce(
        (sum: number, b: any) => sum + (b.dailyExpenses || 0),
        0
      );
      setProfileData({ totalRevenue, totalProfit, totalExpenses });
    }
  }, [open, player, businesses]);

  if (!player) return null;

  const totalStaff = businesses.reduce(
    (sum: number, b: any) => sum + (b._count?.employees || 0),
    0
  );
  const level = player.level || 1;
  const experience = player.experience || 0;
  const nextLevelExp = level * 1000;
  const xpPercent = Math.min((experience / nextLevelExp) * 100, 100);
  const firstLetter = player.name?.charAt(0)?.toUpperCase() || '?';

  // Compute days played from createdAt
  const createdAt = player.createdAt ? new Date(player.createdAt) : null;
  const totalDaysPlayed = createdAt
    ? Math.max(1, Math.ceil((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)))
    : 1;

  // Cash earned/lost: netWorth - startingCash (500,000)
  const STARTING_CASH = 500000;
  const cashDelta = (player.netWorth || 0) - STARTING_CASH;

  // Average daily profit
  const avgDailyProfit =
    gameDay > 0 && profileData
      ? (profileData.totalProfit * gameDay) / gameDay || profileData.totalProfit
      : 0;

  const statCards = [
    {
      icon: <Wallet className='h-4 w-4' />,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-700',
      label: 'Cash',
      value: formatTaka(player.cash || 0),
    },
    {
      icon: <TrendingUp className='h-4 w-4' />,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-700',
      label: 'Net Worth',
      value: formatTaka(player.netWorth || 0),
    },
    {
      icon: <Building2 className='h-4 w-4' />,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-700',
      label: 'Total Businesses',
      value: String(businesses.length),
    },
    {
      icon: <Users className='h-4 w-4' />,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-700',
      label: 'Total Staff',
      value: String(totalStaff),
    },
    {
      icon: <CalendarDays className='h-4 w-4' />,
      iconBg: 'bg-cyan-100',
      iconColor: 'text-cyan-700',
      label: 'Game Day',
      value: String(gameDay),
    },
    {
      icon: <BarChart3 className='h-4 w-4' />,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-700',
      label: 'Total Revenue',
      value: profileData ? formatTaka(profileData.totalRevenue) : '---',
    },
    {
      icon: <TrendingUp className='h-4 w-4' />,
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-700',
      label: 'Total Profit',
      value: profileData
        ? formatTaka(profileData.totalProfit)
        : '---',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='sm:max-w-md max-h-[90vh] overflow-y-auto p-0'
      >
        <AnimatePresence mode='wait'>
          {open && (
            <motion.div
              variants={stagger}
              initial='hidden'
              animate='visible'
              exit='exit'
              className='p-5 space-y-5'
            >
              {/* Header with Avatar */}
              <motion.div variants={slideUp} className='text-center'>
                <DialogHeader className='sr-only'>
                  <DialogTitle>Player Profile</DialogTitle>
                  <DialogDescription>View your player stats and progress</DialogDescription>
                </DialogHeader>

                <div className='flex justify-center mb-3'>
                  <div
                    className='h-20 w-20 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg ring-4 ring-white'
                    style={{
                      background: 'linear-gradient(135deg, #006a4e 0%, #00a86b 100%)',
                    }}
                  >
                    {firstLetter}
                  </div>
                </div>

                <h2 className='text-xl font-bold'>{player.name}</h2>

                <div className='flex items-center justify-center gap-2 mt-1.5'>
                  <Badge
                    className='text-xs px-2 py-0.5 text-white font-bold'
                    style={{
                      background: 'linear-gradient(135deg, #006a4e, #00a86b)',
                    }}
                  >
                    Level {level}
                  </Badge>
                  <span className='text-xs text-muted-foreground'>
                    Day {gameDay}
                  </span>
                </div>

                {/* XP Bar */}
                <div className='mt-3 max-w-xs mx-auto space-y-1'>
                  <div className='flex justify-between text-[11px] text-muted-foreground'>
                    <span>Experience</span>
                    <span>
                      {experience.toLocaleString()} / {nextLevelExp.toLocaleString()} XP
                    </span>
                  </div>
                  <div className='relative'>
                    <Progress value={xpPercent} className='h-2.5' />
                    <div
                      className='absolute inset-0 h-2.5 rounded-full pointer-events-none'
                      style={{
                        background:
                          xpPercent > 0
                            ? 'linear-gradient(90deg, #006a4e, #00a86b)'
                            : 'none',
                        opacity: 0.3,
                      }}
                    />
                  </div>
                </div>
              </motion.div>

              <Separator />

              {/* Detailed Stats Grid */}
              <motion.div variants={slideUp}>
                <h3 className='text-sm font-bold mb-2.5 flex items-center gap-1.5'>
                  <BarChart3 className='h-4 w-4' style={{ color: '#006a4e' }} />
                  Overview
                </h3>
                <div className='grid grid-cols-2 gap-2'>
                  {statCards.map((stat) => (
                    <Card
                      key={stat.label}
                      className='border shadow-sm hover:shadow-md transition-shadow'
                    >
                      <CardContent className='p-3'>
                        <div className='flex items-center gap-2 mb-1.5'>
                          <div
                            className={`h-7 w-7 rounded-lg ${stat.iconBg} flex items-center justify-center`}
                          >
                            <span className={stat.iconColor}>{stat.icon}</span>
                          </div>
                          <span className='text-[10px] text-muted-foreground font-medium uppercase tracking-wider leading-tight'>
                            {stat.label}
                          </span>
                        </div>
                        <div
                          className='text-sm font-bold truncate'
                          style={{ color: '#006a4e' }}
                        >
                          {stat.value}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </motion.div>

              <Separator />

              {/* Detailed Stats Section */}
              <motion.div variants={slideUp}>
                <h3 className='text-sm font-bold mb-2.5 flex items-center gap-1.5'>
                  <Clock className='h-4 w-4' style={{ color: '#006a4e' }} />
                  Stats
                </h3>
                <Card className='border shadow-sm'>
                  <CardContent className='p-4 space-y-4'>
                    {/* Total Days Played */}
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <CalendarDays className='h-4 w-4 text-muted-foreground' />
                        <span className='text-sm text-muted-foreground'>
                          Total Days Played
                        </span>
                      </div>
                      <span className='text-sm font-bold'>{totalDaysPlayed} days</span>
                    </div>

                    <Separator />

                    {/* Cash Earned / Lost */}
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        {cashDelta >= 0 ? (
                          <ArrowUpRight className='h-4 w-4 text-green-600' />
                        ) : (
                          <ArrowDownRight className='h-4 w-4 text-red-500' />
                        )}
                        <span className='text-sm text-muted-foreground'>
                          Cash Earned/Lost
                        </span>
                      </div>
                      <span
                        className={`text-sm font-bold ${
                          cashDelta >= 0 ? 'text-green-600' : 'text-red-500'
                        }`}
                      >
                        {cashDelta >= 0 ? '+' : ''}
                        {formatTaka(cashDelta)}
                      </span>
                    </div>

                    <Separator />

                    {/* Average Daily Profit */}
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <BarChart3 className='h-4 w-4 text-muted-foreground' />
                        <span className='text-sm text-muted-foreground'>
                          Avg. Daily Profit
                        </span>
                      </div>
                      <span
                        className={`text-sm font-bold ${
                          avgDailyProfit >= 0
                            ? 'text-green-600'
                            : 'text-red-500'
                        }`}
                      >
                        {avgDailyProfit >= 0 ? '+' : ''}
                        {formatTakaShort(avgDailyProfit)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Close Button */}
              <motion.div variants={slideUp} className='pt-1'>
                <Button
                  onClick={() => onOpenChange(false)}
                  className='w-full gap-1.5 text-white'
                  style={{
                    background: 'linear-gradient(135deg, #006a4e 0%, #00a86b 100%)',
                  }}
                >
                  <X className='h-4 w-4' />
                  Close Profile
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
