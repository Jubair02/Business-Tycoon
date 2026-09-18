'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Download, BellRing, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/I18nProvider';

/**
 * The `beforeinstallprompt` event, which TypeScript's DOM lib does not describe.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Turn the VAPID public key into the bytes `pushManager.subscribe` wants.
 *
 * Typed as `ArrayBuffer` rather than `Uint8Array`: TypeScript's DOM lib types
 * `applicationServerKey` as a `BufferSource` backed specifically by an
 * `ArrayBuffer`, which a plain `Uint8Array` does not satisfy.
 */
const STANDALONE_QUERY = '(display-mode: standalone)';

/**
 * Whether the game is already running as an installed app.
 *
 * Subscribed to rather than copied into state by an effect: it is a value that
 * lives outside React, and mirroring it meant a synchronous setState inside an
 * effect — the cascading-render pattern React 19 flags.
 */
function subscribeToDisplayMode(onStoreChange: () => void): () => void {
  const query = window.matchMedia(STANDALONE_QUERY);
  query.addEventListener('change', onStoreChange);
  return () => query.removeEventListener('change', onStoreChange);
}

function urlBase64ToBytes(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

/**
 * Installing the game and turning on notifications.
 *
 * Both live in Settings rather than as an interstitial: a prompt to install
 * something the player has used once is the fastest way to be dismissed
 * permanently, and on iOS the install has to be done from the share sheet
 * anyway, so the honest thing is to explain rather than to nag.
 */
export default function PwaManager() {
  const { locale } = useI18n();

  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installedThisSession, setInstalledThisSession] = useState(false);
  const runningStandalone = useSyncExternalStore(
    subscribeToDisplayMode,
    () => window.matchMedia(STANDALONE_QUERY).matches,
    () => false,
  );
  const installed = runningStandalone || installedThisSession;
  const [pushSupported, setPushSupported] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  // ---- Register the service worker ----
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    let cancelled = false;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        if (!cancelled) setRegistration(reg);
      })
      .catch(() => {
        // A blocked or unsupported worker just means no offline page and no
        // push; the game itself is unaffected.
      });

    return () => { cancelled = true; };
  }, []);

  // ---- Listen for the install opportunity ----
  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalledThisSession(true);
      setInstallEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // ---- Ask the server whether push is available here ----
  useEffect(() => {
    let cancelled = false;
    fetch('/api/push/subscribe')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data) return;
        setPushSupported(Boolean(data.supported) && 'PushManager' in window);
        setPublicKey(data.publicKey ?? null);
        setSubscribed(Boolean(data.subscribed));
      })
      .catch(() => {
        // Leave push reported as unavailable.
      });
    return () => { cancelled = true; };
  }, []);

  const install = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') setInstalledThisSession(true);
    setInstallEvent(null);
  }, [installEvent]);

  const subscribe = useCallback(async () => {
    if (!registration || !publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Notifications are blocked for this site in your browser settings.');
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        // Required by every browser: a push that cannot be shown is not allowed.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(publicKey),
      });

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...subscription.toJSON(), locale }),
      });

      if (!res.ok) throw new Error('Subscribe failed');
      setSubscribed(true);
      toast.success("You'll be told when a shop sells out or a rival takes your staff.");
    } catch {
      toast.error('Could not turn on notifications.');
    } finally {
      setBusy(false);
    }
  }, [registration, publicKey, locale]);

  const unsubscribe = useCallback(async () => {
    if (!registration) return;
    setBusy(true);
    try {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      toast.success('Notifications turned off.');
    } catch {
      toast.error('Could not turn off notifications.');
    } finally {
      setBusy(false);
    }
  }, [registration]);

  const canPrompt = Boolean(installEvent);
  // iOS gives no install event at all — it has to be done from the share sheet,
  // so saying so is more useful than showing a button that cannot work.
  const isIos =
    typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <Card className="game-shine">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-muted-foreground" />
          Install &amp; notifications
        </CardTitle>
        <CardDescription className="text-xs">
          Add the game to your home screen and get told when a shop needs you.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {/* ---- Install ---- */}
        {installed ? (
          <p className="text-xs text-muted-foreground">
            Installed. The game opens in its own window and works offline enough to tell you so.
          </p>
        ) : canPrompt ? (
          <Button onClick={install} size="sm" className="w-full gap-2 text-white" style={{ background: '#006a4e' }}>
            <Download className="h-3.5 w-3.5" />
            Add to home screen
          </Button>
        ) : isIos ? (
          <p className="text-xs text-muted-foreground">
            On iPhone: tap Share, then <span className="font-medium text-foreground">Add to Home Screen</span>.
            Notifications only work once it is installed.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Your browser will offer to install the game once you have used it a little.
          </p>
        )}

        {/* ---- Push ---- */}
        {pushSupported ? (
          <div className="flex items-start justify-between gap-3 border-t border-[var(--bt-hairline)] pt-4">
            <div className="min-w-0">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <BellRing className="h-3.5 w-3.5 text-[var(--bt-emerald)]" aria-hidden="true" />
                Notifications
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Empty shelves, poached staff, and the last days of a season. Nothing else.
              </p>
            </div>
            <Switch
              checked={subscribed}
              disabled={busy || !registration}
              aria-label="Push notifications"
              onCheckedChange={checked => (checked ? subscribe() : unsubscribe())}
            />
          </div>
        ) : (
          <p className="border-t border-[var(--bt-hairline)] pt-4 text-xs text-muted-foreground">
            Push notifications are not available here.
            {isIos && ' On iPhone they require the game to be installed to the home screen first.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
