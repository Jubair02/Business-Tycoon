'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, Lock, Mail, User as UserIcon, Wallet } from 'lucide-react';
import { readApiError } from '@/lib/api-error';
import { ROUTES } from '@/lib/game-routes';
import { cn } from '@/lib/utils';

type Mode = 'signin' | 'signup';

interface AuthPanelProps {
  /** False when the server has no Google credentials — the button is then hidden. */
  googleEnabled: boolean;
}

/** Google's brand mark, inlined so the button works offline and in both themes. */
function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.28a12 12 0 0 0 0 10.78l4.01-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4.01 3.11C6.23 6.86 8.88 4.75 12 4.75z"
      />
    </svg>
  );
}

/**
 * Sign-in / sign-up card on the welcome screen.
 *
 * Both paths end the same way: a session cookie is set by the API, so the
 * server guard on `/dashboard` sees the player on the very next request. The
 * `router.refresh()` is what re-runs that guard.
 */
export default function AuthPanel({ googleEnabled }: AuthPanelProps) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === 'signup';

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const validate = (): string | null => {
    if (isSignup) {
      const trimmed = name.trim();
      if (trimmed.length < 2) return 'Enter your name (at least 2 characters).';
      if (trimmed.length > 30) return 'Name must be 30 characters or less.';
    }
    if (!email.trim()) return 'Enter your email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.';
    if (!password) return 'Enter your password.';
    if (isSignup && password.length < 8) return 'Password must be at least 8 characters.';
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(isSignup ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isSignup
            ? { name: name.trim(), email: email.trim(), password }
            : { email: email.trim(), password }
        ),
      });

      if (!res.ok) {
        const message = await readApiError(
          res,
          isSignup ? 'Could not create your account.' : 'Could not sign you in.'
        );
        setError(message);
        toast.error(message);
        return;
      }

      // The store is deliberately left alone: the game shell loads the full
      // player record on mount, and seeding a partial one here would flash
      // half-filled figures in the top bar.
      const data = await res.json();

      toast.success(
        data.claimedGuestSave
          ? 'Signed in — your existing progress is now saved to this account.'
          : isSignup
            ? `Welcome, ${data.user?.name ?? name.trim()}! Your empire begins now.`
            : `Welcome back, ${data.user?.name ?? ''}`.trim()
      );

      router.replace(ROUTES.dashboard);
      router.refresh();
    } catch {
      const message = 'Network error. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bt-surface-raised bt-edge bt-sheen p-5 sm:p-6">
      {/* Mode switch */}
      <div
        role="tablist"
        aria-label="Sign in or create an account"
        className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-muted/50 p-1"
      >
        {(['signin', 'signup'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => switchMode(value)}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-semibold transition-all',
              mode === value
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {value === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      {googleEnabled && (
        <>
          <Button
            asChild
            variant="outline"
            className="h-12 w-full rounded-xl text-base font-semibold"
          >
            {/* A plain link, not fetch(): the OAuth flow is a full-page redirect. */}
            <a href="/api/auth/google">
              <GoogleMark />
              Continue with Google
            </a>
          </Button>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--bt-hairline)]" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-[var(--bt-hairline)]" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {isSignup && (
          <div className="space-y-1.5">
            <label htmlFor="auth-name" className="block text-sm font-semibold">
              Your name
            </label>
            <div className="relative">
              <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="auth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahim Uddin"
                className="h-12 rounded-xl pl-9 text-base"
                autoComplete="name"
                maxLength={30}
                disabled={submitting}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This is how you&apos;ll appear on the leaderboard.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="auth-email" className="block text-sm font-semibold">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-12 rounded-xl pl-9 text-base"
              autoComplete="email"
              disabled={submitting}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="auth-password" className="block text-sm font-semibold">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignup ? 'At least 8 characters' : 'Your password'}
              className="h-12 rounded-xl pl-9 text-base"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              disabled={submitting}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="bt-text-loss text-xs font-medium">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="bt-btn-primary mt-1 h-12 w-full rounded-xl text-base font-semibold disabled:opacity-50"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              {isSignup ? 'Creating your account…' : 'Signing you in…'}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              {isSignup ? 'Start Your Empire' : 'Continue'}
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-center gap-2 border-t border-[var(--bt-hairline)] pt-4">
        <Wallet className="h-3.5 w-3.5 text-[var(--bt-gold-deep)] dark:text-[var(--bt-gold-bright)]" />
        <span className="text-xs text-muted-foreground">
          {isSignup ? 'Starting capital' : 'Your empire is waiting'}
        </span>
        {isSignup && (
          <span className="bt-text-gold bt-numeric text-sm font-bold">৳5,00,000</span>
        )}
      </div>
    </div>
  );
}
