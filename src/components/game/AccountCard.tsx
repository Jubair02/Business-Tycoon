'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { LogOut, ShieldCheck, UserCircle } from 'lucide-react';

interface AccountProfile {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    hasPassword: boolean;
    providers: string[];
  } | null;
  player: { id: string; name: string } | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
};

/**
 * The signed-in account, shown in Settings.
 *
 * This is where a player confirms their progress is attached to something
 * durable — which account holds this save, and how they get back into it.
 */
export default function AccountCard() {
  const router = useRouter();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok && !cancelled) {
          setProfile(await res.json());
        }
      } catch {
        // Leave the card in its empty state; the game itself still works.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (!res.ok) {
        toast.error('Could not sign out. Please try again.');
        return;
      }
      toast.success('Signed out. Your empire is saved.');
      router.replace('/');
      router.refresh();
    } catch {
      toast.error('Network error');
    } finally {
      setSigningOut(false);
    }
  }, [router]);

  const user = profile?.user ?? null;
  const signInMethods = [
    ...(user?.providers ?? []).map((p) => PROVIDER_LABELS[p] ?? p),
    ...(user?.hasPassword ? ['Password'] : []),
  ];

  return (
    <Card className="game-shine">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <UserCircle className="h-4 w-4 text-muted-foreground" />
          Account
        </CardTitle>
        <CardDescription className="text-xs">
          Your progress is saved to this account and follows you to any device.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {loading ? (
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
        ) : user ? (
          <>
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11">
                {user.image && <AvatarImage src={user.image} alt="" />}
                <AvatarFallback>{user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{user.name}</div>
                <div className="truncate text-xs text-muted-foreground">{user.email}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Sign in with</span>
              {signInMethods.map((method) => (
                <Badge key={method} variant="outline" className="text-[10px]">
                  {method}
                </Badge>
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              <LogOut className="h-4 w-4" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            You are not signed in. Sign in to save your progress.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
