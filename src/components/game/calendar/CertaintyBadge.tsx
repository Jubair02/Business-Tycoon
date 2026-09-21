'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CalendarCheck, CalendarClock, CircleHelp } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { Certainty } from '@/lib/calendar/observances';

const TONE: Record<Certainty, string> = {
  FIXED: 'bt-tone-slate',
  CONFIRMED: 'bt-tone-emerald',
  // Deliberately the one that draws the eye. An estimated Eid date dressed to
  // look like a settled one is the failure this whole feature is written around.
  ESTIMATED: 'bt-tone-amber',
};

const ICON: Record<Certainty, typeof CalendarCheck> = {
  FIXED: CalendarCheck,
  CONFIRMED: CalendarCheck,
  ESTIMATED: CircleHelp,
};

/**
 * How sure the game is about a date.
 *
 * Shown on every religious observance, never suppressed to tidy the layout: in
 * Bangladesh the Eid date is decided by a moon sighting the evening before, and
 * a calendar that hides that is wrong about the thing that matters most.
 */
export default function CertaintyBadge({
  certainty,
  className,
  compact = false,
}: {
  certainty: Certainty;
  className?: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const Icon = ICON[certainty] ?? CalendarClock;

  // A fixed Gregorian date needs no badge — nobody wonders whether Victory Day
  // is really on the 16th.
  if (certainty === 'FIXED') return null;

  return (
    <Badge
      variant="outline"
      className={cn('bt-tone gap-1 rounded-full px-2 text-[10px] font-medium', TONE[certainty], className)}
      title={certainty === 'ESTIMATED' ? t('calendar.estimatedNote') : t('calendar.confirmedNote')}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden="true" />
      {!compact && t(`calendar.certainty.${certainty}` as const)}
    </Badge>
  );
}
