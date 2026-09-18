'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/game-store';
import { Lightbulb, ChevronDown, ChevronUp, AlertTriangle, Flame } from 'lucide-react';
import { getBusinessType, PRODUCTS } from '@/lib/game-data';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const MOTIVATIONAL_TIPS = [
  '🔥 Keep expanding your empire!',
  '📈 Diversify your businesses for stability.',
  '🎯 High reputation attracts more customers!',
  '💰 Reinvest profits to grow faster.',
  '🏗️ Upgrade businesses to increase capacity.',
  '🏪 Different cities have different advantages.',
  '🏆 Check the leaderboard to see your ranking!',
  '📊 Watch market prices before buying stock.',
];

export default function HintBar() {
  const { player, businesses, events } = useGameStore();
  const [isOpen, setIsOpen] = useState(true);

  const getHint = () => {
    if (!player) return null;

    // No businesses
    if (businesses.length === 0) {
      return { icon: <Lightbulb className="h-4 w-4 text-amber-500 dark:text-amber-400" />, text: '💡 Tip: Create your first business to start earning!', type: 'tip' as const };
    }

    // Check for businesses with no inventory
    const bizNoInventory = businesses.find((b: any) => {
      return !(b._count?.inventories > 0);
    });
    if (bizNoInventory) {
      const bt = getBusinessType(bizNoInventory.type);
      return { icon: <Lightbulb className="h-4 w-4 text-amber-500 dark:text-amber-400" />, text: `💡 Tip: Buy stock for "${bt?.icon || ''} ${bizNoInventory.name}" to attract customers!`, type: 'tip' as const };
    }

    // Check for businesses with no employees
    const bizNoEmployees = businesses.find((b: any) => {
      return !(b._count?.employees > 0);
    });
    if (bizNoEmployees) {
      return { icon: <Lightbulb className="h-4 w-4 text-amber-500 dark:text-amber-400" />, text: '💡 Tip: Hire staff to boost your reputation and sales!', type: 'tip' as const };
    }

    // Low cash warning
    if (player.cash < 100000) {
      return { icon: <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />, text: '⚠️ Low on cash! Consider buying cheaper inventory or wait for profits.', type: 'warning' as const };
    }

    // Active events
    if (events.length > 0) {
      const evt = events[0];
      return { icon: <Flame className="h-4 w-4 text-orange-500 dark:text-orange-400" />, text: `🔥 Event: ${evt.title}`, type: 'event' as const };
    }

    // Rotating motivational tips
    const tipIndex = Math.floor(Date.now() / 15000) % MOTIVATIONAL_TIPS.length;
    return { icon: null, text: MOTIVATIONAL_TIPS[tipIndex], type: 'motivation' as const };
  };

  const hint = getHint();
  if (!hint) return null;

  return (
    <div className="px-3 md:px-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className={`rounded-lg border p-2.5 flex items-center gap-2 text-sm ${
          hint.type === 'warning' ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60' :
          hint.type === 'event' ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900/60' :
          'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60'
        }`}>
          {hint.icon}
          <span className="flex-1 text-xs font-medium">{hint.text}</span>
          <CollapsibleTrigger asChild>
            <button className="shrink-0 text-muted-foreground hover:text-foreground">
              {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="mt-1.5 text-[10px] text-muted-foreground px-1 flex items-center justify-between">
            <span>Contextual tips update based on your game state</span>
            <button
              className="text-[10px] text-muted-foreground hover:text-foreground underline"
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
            >
              Dismiss
            </button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
