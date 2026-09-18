'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ThemeSegmentedControl } from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import PwaManager from './PwaManager';
import { useT } from '@/lib/i18n/I18nProvider';
import AccountCard from './AccountCard';
import {
  Settings as SettingsIcon,
  RotateCcw,
  Trash2,
  Info,
  Zap,
  Clock,
  Gamepad2,
  Palette,
  Volume2,
  VolumeX,
  ChevronRight,
  Check,
  AlertTriangle,
  Database,
  Languages,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/lib/api-error';

export default function SettingsView() {
  const { player, gameDay, businesses } = useGameStore();
  const t = useT();
  const [clock, setClock] = useState<{ schedulerEnabled: boolean; tickIntervalMs: number | null }>({
    schedulerEnabled: true,
    tickIntervalMs: null,
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    // Guarded like the auto-tick setting above: this initialiser also runs
    // during server rendering, where localStorage does not exist.
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('bd-tycoon-sound') !== 'false';
  });
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/game/state');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setClock({
          schedulerEnabled: data.schedulerEnabled !== false,
          tickIntervalMs: typeof data.tickIntervalMs === 'number' ? data.tickIntervalMs : null,
        });
      } catch {
        /* leave the defaults in place */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleResetGame = async () => {
    if (resetConfirm !== 'RESET') return;
    setResetting(true);
    try {
      const res = await fetch('/api/game/reset', { method: 'POST' });
      if (res.ok) {
        // Clear tutorial flag
        localStorage.removeItem('bd-tycoon-tutorial-done');
        toast.success('Game reset! Starting fresh...');
        // Reload page to reinitialize
        setTimeout(() => window.location.reload(), 1000);
      } else {
        const err = await res.json();
        toast.error(apiErrorMessage(err, 'Failed to reset'));
      }
    } catch {
      toast.error('Network error');
    } finally {
      setResetting(false);
    }
  };

  const statsCards = [
    { label: 'Game Day', value: `Day ${gameDay}`, icon: <Clock className="h-4 w-4" />, color: '#006a4e' },
    { label: 'Businesses', value: `${businesses.length}`, icon: <Gamepad2 className="h-4 w-4" />, color: '#006a4e' },
    { label: 'Level', value: `${player?.level || 1}`, icon: <Zap className="h-4 w-4" />, color: '#006a4e' },
    { label: 'Total Staff', value: `${businesses.reduce((sum: number, b: any) => sum + (b._count?.employees || b.employees?.length || 0), 0)}`, icon: <Database className="h-4 w-4" />, color: '#006a4e' },
  ];

  return (
    <div className="p-3 md:p-4 space-y-4 pb-24 md:pb-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #006a4e, #00a86b)' }}
        >
          <SettingsIcon className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold game-gradient-text game-section-header">Settings</h2>
          <p className="text-[10px] text-muted-foreground">Game preferences and controls</p>
        </div>
      </div>

      {/* Account */}
      <AccountCard />

      {/* Install & notifications */}
      <PwaManager />

      {/* Language */}
      <Card className="game-shine">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Languages className="h-4 w-4 text-muted-foreground" />
            {t('settings.language')}
          </CardTitle>
          <CardDescription className="text-xs">
            {t('settings.languageHelp')}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <LanguageSwitcher />
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="game-shine">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            Appearance
          </CardTitle>
          <CardDescription className="text-xs">
            Choose a colour theme. System follows your device setting.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ThemeSegmentedControl />
        </CardContent>
      </Card>

      {/* Game Statistics */}
      <Card className="game-shine">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            Game Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            {statsCards.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-lg border p-3 text-center bg-gradient-to-b from-[var(--bt-surface-1)] to-[var(--bt-surface-2)] game-stat-card"
              >
                <div className="flex items-center justify-center mb-1">
                  <div
                    className="h-7 w-7 rounded-lg flex items-center justify-center"
                    style={{ background: `${stat.color}10` }}
                  >
                    <span style={{ color: stat.color }}>{stat.icon}</span>
                  </div>
                </div>
                <div className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</div>
                <div className="text-[10px] text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* World clock (read-only) */}
      <Card className="game-shine">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 game-section-header">
            <Clock className="h-4 w-4 text-muted-foreground" />
            World Clock
          </CardTitle>
          <CardDescription className="text-xs">
            Days advance on the server, at the same pace for everyone.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2.5">
            <div>
              <p className="text-xs font-semibold">
                {clock.schedulerEnabled ? 'Running' : 'Paused'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {clock.schedulerEnabled && clock.tickIntervalMs
                  ? `One game day every ${Math.round(clock.tickIntervalMs / 1000)}s`
                  : 'No clock is running on the server'}
              </p>
            </div>
            <span className="bt-numeric text-sm font-semibold">Day {gameDay}</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            This used to be a per-player auto-play speed. Because one tick moves the
            world for every player and every competitor, the pace is now set by the
            server rather than by whoever has the game open.
          </p>
        </CardContent>
      </Card>

      {/* Sound Toggle */}
      <Card className="game-shine">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            Sound & Effects
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Sound Effects</div>
              <div className="text-xs text-muted-foreground">Toggle in-game sounds</div>
            </div>
            <button
              onClick={() => {
                localStorage.setItem('bd-tycoon-sound', String(!soundEnabled));
                setSoundEnabled(!soundEnabled);
                toast.success(soundEnabled ? 'Sound muted' : 'Sound enabled');
              }}
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors duration-200',
                soundEnabled ? 'bg-green-600' : 'bg-muted-foreground/30'
              )}
            >
              <motion.div
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
                animate={{ left: soundEnabled ? 22 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* About / Help */}
      <Card className="game-shine">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-muted-foreground" />
            About
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Version</span>
            <Badge variant="outline" className="text-[10px]">v2.1</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Engine</span>
            <span className="text-xs font-medium">1 min = 1 game day</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Cities</span>
            <span className="text-xs font-medium">5 (Dhaka, Chattogram, Sylhet, Rajshahi, Khulna)</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Business Types</span>
            <span className="text-xs font-medium">5 types, 28 products</span>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone - Reset Game */}
      <Card className="border-red-200/60 dark:border-red-900/60 game-gradient-border rounded-xl">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
          <CardDescription className="text-xs">
            These actions cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Button
            variant="outline"
            className="w-full text-red-600 dark:text-red-400 border-red-300 dark:border-red-800/70 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-300 gap-2 game-pulse-red"
            onClick={() => {
              setResetConfirm('');
              setShowResetDialog(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Reset Game & Start Over
          </Button>
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Reset Game
            </DialogTitle>
            <DialogDescription>
              This will permanently delete ALL your businesses, employees, inventory, loans, and history.
              Your player account will be reset to Day 1 with ৳5,00,000 starting cash.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 p-3 text-sm text-red-700 dark:text-red-300">
              <strong>Warning:</strong> This action is irreversible. All progress will be lost.
            </div>
            <div>
              <label className="text-sm font-medium">Type &quot;RESET&quot; to confirm:</label>
              <Input
                type="text"
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                placeholder="RESET"
                className="mt-1 border-red-300 dark:border-red-800/70 focus-visible:ring-red-400"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>Cancel</Button>
            <Button
              onClick={handleResetGame}
              disabled={resetting || resetConfirm !== 'RESET'}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {resetting ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Resetting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Reset Everything
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
