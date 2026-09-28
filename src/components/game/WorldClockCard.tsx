'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { Gauge, KeyRound, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/I18nProvider';

interface ClockPayload {
  speed: number;
  speeds: number[];
  effectiveIntervalMs: number;
  running: boolean;
}

/**
 * Where the operator secret is kept between clicks.
 *
 * Session storage, not local: it lives as long as the tab and no longer. The
 * secret is the same bearer token a `curl` would send, so typing it here is the
 * same trust as typing it into a terminal — but it should not outlive the
 * session that typed it.
 */
const SECRET_KEY = 'bt-operator-secret';

function readSecret(): string {
  try {
    return window.sessionStorage.getItem(SECRET_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Session storage is a store outside React, so it is subscribed to rather than
 * copied into state by an effect — the cascading-render pattern React 19
 * flags, and the same reason `use-mobile` and the carousel do it this way.
 * The subscription is a tiny listener set that `writeSecret` pokes.
 */
const listeners = new Set<() => void>();

function subscribeToSecret(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function writeSecret(value: string): void {
  try {
    if (value) window.sessionStorage.setItem(SECRET_KEY, value);
    else window.sessionStorage.removeItem(SECRET_KEY);
  } catch {
    // Storage refused; the secret is simply asked for again next time.
  }
  for (const listener of listeners) listener();
}

/** Whether a secret is remembered for this tab. False on the server, so hydration matches. */
function secretRemembered(): boolean {
  return Boolean(readSecret());
}

function secretRememberedOnServer(): boolean {
  return false;
}

/**
 * The world clock's speed dial, in Settings.
 *
 * The dial existed only as an API call, which meant it did not exist for
 * anyone who does not live in a terminal. This is the same call with buttons
 * on it. Reading the speed is open to everyone; changing it needs the operator
 * secret, because one tick moves the day for every player in the world.
 */
export default function WorldClockCard() {
  const { t } = useI18n();
  const [clock, setClock] = useState<ClockPayload | null>(null);
  /** The password field's draft. Never pre-filled from storage. */
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const remembered = useSyncExternalStore(subscribeToSecret, secretRemembered, secretRememberedOnServer);

  // Loaded the way every other panel here loads: fetch in the effect, state
  // set from the `then`.
  useEffect(() => {
    let cancelled = false;

    fetch('/api/admin/clock')
      .then(res => (res.ok ? res.json() : null))
      .then((payload: ClockPayload | null) => {
        if (!cancelled && payload) setClock(payload);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [refreshKey]);

  const setSpeed = async (speed: number) => {
    // A freshly typed secret wins; otherwise the one remembered for this tab.
    const token = secret || readSecret();
    if (!token) {
      toast.error(t('clock.needSecret'));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/admin/clock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ speed }),
      });

      if (res.status === 401) {
        // A wrong secret is forgotten immediately, so it is not re-sent on
        // every click until the tab closes.
        writeSecret('');
        setSecret('');
        toast.error(t('clock.wrongSecret'));
        return;
      }

      if (!res.ok) {
        toast.error(t('error.generic'));
        return;
      }

      writeSecret(token);
      setSecret('');
      toast.success(t('clock.speedSet', { speed }));
      setRefreshKey(key => key + 1);
    } catch {
      toast.error(t('error.network'));
    } finally {
      setBusy(false);
    }
  };

  const hours = clock ? clock.effectiveIntervalMs / 3_600_000 : null;
  /**
   * Whether clicking a speed could possibly succeed. The buttons are disabled
   * otherwise — the first version let you click 4x with an empty secret field
   * and answered with an error toast, which is a trap, not a control.
   */
  const hasToken = secret.length > 0 || remembered;

  return (
    <Card className="game-shine">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Gauge className="h-4 w-4" aria-hidden="true" />
          {t('clock.title')}
        </CardTitle>
        <CardDescription className="text-xs">{t('clock.help')}</CardDescription>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* Current pace, readable by everyone. */}
        <div className="bt-surface flex flex-wrap items-baseline justify-between gap-2 p-2.5 text-xs">
          <span className="text-muted-foreground">{t('clock.current')}</span>
          <span className="bt-numeric font-semibold">
            {clock ? `${clock.speed}× · ${t('clock.dayLength', { hours: hours ?? 0 })}` : '…'}
          </span>
        </div>

        {/* Changing the pace is an operator action, and the world is shared. */}
        <div>
          <Label htmlFor="operator-secret" className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <KeyRound className="h-3 w-3" aria-hidden="true" />
            {t('clock.secretLabel')}
          </Label>
          <Input
            id="operator-secret"
            type="password"
            autoComplete="off"
            value={secret}
            placeholder={remembered ? t('clock.secretRemembered') : t('clock.secretPlaceholder')}
            className="mt-1 h-9 text-xs"
            onChange={e => setSecret(e.target.value)}
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {t('clock.warning')}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {(clock?.speeds ?? [1, 2, 4, 8]).map(speed => {
            const active = clock?.speed === speed;
            return (
              <Button
                key={speed}
                variant={active ? 'default' : 'outline'}
                disabled={busy || active || !hasToken}
                className={cn('h-10 text-sm font-bold', active && 'pointer-events-none')}
                onClick={() => setSpeed(speed)}
                aria-pressed={active}
              >
                {busy && !active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `${speed}×`}
              </Button>
            );
          })}
        </div>

        {/* Said inline, before anyone clicks — not as an error after. */}
        {!hasToken && (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t('clock.enterSecretHint')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
