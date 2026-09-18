'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { id: 'light', label: 'Light', icon: Sun, hint: 'Always bright' },
  { id: 'dark', label: 'Dark', icon: Moon, hint: 'Always dim' },
  { id: 'system', label: 'System', icon: Monitor, hint: 'Match your device' },
] as const;

/**
 * True only after hydration. next-themes cannot know the stored preference
 * during SSR, so anything that depends on the *chosen* theme (as opposed to
 * the resolved one, which CSS handles) has to wait for the client.
 */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount flag; there is no other way to detect hydration
    setMounted(true);
  }, []);
  return mounted;
}

/**
 * Compact theme switcher for the top bar.
 *
 * The icon is driven by the `dark` class via CSS rather than React state,
 * so it renders correctly on the server and never flashes the wrong glyph
 * during hydration. Only the menu's checkmark needs the mounted guard.
 */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Change colour theme"
          className={cn(
            'bt-tap relative h-9 w-9 rounded-lg text-muted-foreground transition-colors hover:bg-[var(--bt-surface-3)] hover:text-foreground',
            className,
          )}
        >
          <Sun className="h-[1.1rem] w-[1.1rem] rotate-0 scale-100 transition-transform duration-300 dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.1rem] w-[1.1rem] rotate-90 scale-0 transition-transform duration-300 dark:rotate-0 dark:scale-100" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        {OPTIONS.map(({ id, label, icon: Icon }) => (
          <DropdownMenuItem
            key={id}
            onClick={() => setTheme(id)}
            className="cursor-pointer gap-2 text-sm"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="flex-1">{label}</span>
            {mounted && theme === id && (
              <Check className="h-3.5 w-3.5 text-[var(--bt-emerald)]" aria-hidden="true" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Full three-way control for the Settings screen, where there is room to
 * label each choice and explain what "System" means.
 */
export function ThemeSegmentedControl() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="grid grid-cols-3 gap-2"
    >
      {OPTIONS.map(({ id, label, icon: Icon, hint }) => {
        // Before hydration nothing is marked active, which avoids briefly
        // highlighting the wrong option on a dark-mode reload.
        const active = mounted && theme === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(id)}
            className={cn(
              'bt-tap flex-col gap-1.5 rounded-xl border p-3 transition-all duration-200',
              active
                ? 'border-[var(--bt-emerald)] bg-[color-mix(in_oklch,var(--bt-emerald)_10%,transparent)]'
                : 'border-[var(--bt-hairline)] bg-[var(--bt-surface-2)] hover:border-[var(--bt-emerald)]/40',
            )}
            style={active ? { boxShadow: 'var(--bt-shadow-glow)' } : undefined}
          >
            <Icon
              className={cn('h-5 w-5', active ? 'text-[var(--bt-emerald)]' : 'text-muted-foreground')}
              aria-hidden="true"
            />
            <span className={cn('text-xs font-semibold', !active && 'text-muted-foreground')}>
              {label}
            </span>
            <span className="text-center text-[0.6875rem] leading-tight text-muted-foreground">
              {hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
