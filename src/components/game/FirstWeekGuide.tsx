'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown, ChevronUp, Compass, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { evaluateFirstWeek, snapshotFromStore } from '@/lib/game/onboarding/first-week';

const DISMISSED_KEY = 'bd-tycoon-first-week-dismissed';
const FIRST_DAY_KEY = 'bd-tycoon-first-game-day';

/**
 * Read the game day this player first arrived on, seeding it if this is their
 * first visit. Stored per browser because the guide is a client-side nudge, not
 * part of the save — losing it only means the week restarts, never progress.
 *
 * Every access is guarded: a private window or blocked site data makes these
 * throw, and the guide degrades to "day one" rather than taking the page down.
 */
function readFirstGameDay(currentGameDay: number): number | null {
  if (currentGameDay <= 0) return null;
  try {
    const stored = localStorage.getItem(FIRST_DAY_KEY);
    if (stored !== null) {
      const parsed = Number(stored);
      if (Number.isFinite(parsed)) return parsed;
    }
    localStorage.setItem(FIRST_DAY_KEY, String(currentGameDay));
    return currentGameDay;
  } catch {
    return currentGameDay;
  }
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * The guided first week.
 *
 * Onboarding used to end with the welcome slides, leaving a new player in front
 * of an economy with pricing, restocking, staffing, reputation and rivals in
 * it. This is a short list of the things worth doing in the order they start to
 * matter, ticked off by what the save actually contains rather than by clicking
 * through. It retires itself once the week is done.
 */
export default function FirstWeekGuide() {
  const { businesses, gameDay } = useGameStore();
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(readDismissed);

  // Read during render rather than mirrored into state by an effect: this is a
  // value that exists outside React and never changes after the first read.
  const firstSeenGameDay = useSyncExternalStore(
    () => () => {},
    () => readFirstGameDay(gameDay ?? 0),
    () => null,
  );

  const progress = evaluateFirstWeek(
    snapshotFromStore({ businesses, gameDay: gameDay ?? 0, firstSeenGameDay }),
  );

  // The guide is for the first week. Once it is done, or waved away, it goes.
  if (dismissed || progress.finished) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch {
      // A browser that will not remember this will simply show the guide again.
    }
    setDismissed(true);
  };

  return (
    <div className="px-3 md:px-4">
      <Card className="game-gradient-card overflow-hidden">
        <CardContent className="p-3">
          <div className="flex items-start gap-2.5">
            <span className="bt-tone bt-tone-emerald mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg">
              <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Your first week</p>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="bt-numeric text-xs text-muted-foreground">
                    {progress.completedCount}/{progress.totalCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    aria-expanded={expanded}
                    aria-label={expanded ? 'Collapse the first-week guide' : 'Expand the first-week guide'}
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                  >
                    {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={dismiss}
                    aria-label="Dismiss the first-week guide"
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <Progress value={progress.percent} className="mt-2 h-1" />

              {/* Collapsed, the guide is a single line: the one thing to do next. */}
              {!expanded && progress.currentStep && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Next: <span className="font-medium text-foreground">{progress.currentStep.title}</span>
                </p>
              )}
            </div>
          </div>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.ol
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="mt-3 space-y-1.5 overflow-hidden"
              >
                {progress.steps.map((step) => (
                  <li
                    key={step.id}
                    className={cn(
                      'flex items-start gap-2.5 rounded-lg p-2 transition-colors',
                      step.current && 'bg-green-50/70 dark:bg-green-950/30',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[10px]',
                        step.complete
                          ? 'border-transparent bg-[var(--bt-emerald)] text-white'
                          : step.current
                            ? 'border-[var(--bt-emerald)] text-[var(--bt-emerald)]'
                            : 'border-[var(--bt-hairline)] text-muted-foreground',
                      )}
                    >
                      {step.complete && <Check className="h-2.5 w-2.5" />}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-xs font-medium',
                          step.complete && 'text-muted-foreground line-through',
                        )}
                      >
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {step.complete ? step.done : step.detail}
                      </p>
                    </div>

                    {step.current && step.href && (
                      <Button asChild size="sm" variant="outline" className="h-7 shrink-0 text-[11px]">
                        <Link href={step.href}>Go</Link>
                      </Button>
                    )}
                  </li>
                ))}
              </motion.ol>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
