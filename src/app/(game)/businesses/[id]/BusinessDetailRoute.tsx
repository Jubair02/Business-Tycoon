'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useGameStore } from '@/store/game-store';
import BusinessDetail from '@/components/game/BusinessDetail';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/game-routes';

type LoadState = 'loading' | 'ready' | 'missing';

/**
 * Loads the business named in the URL.
 *
 * The id now comes from the route rather than from a click, so opening
 * /businesses/<id> directly — a deep link, a refresh, or the back button — has
 * to fetch the record itself rather than relying on a previous selection.
 */
export default function BusinessDetailRoute({ businessId }: { businessId: string }) {
  const { currentBusiness, setCurrentBusiness, selectBusiness } = useGameStore();

  // The outcome is recorded against the business it belongs to rather than as a
  // bare flag, so "loading" is derived during render. Setting it back to
  // 'loading' inside the effect meant a synchronous setState in an effect body
  // — a cascading render on every navigation — and left a window where the
  // previous business's state was still on screen.
  const [outcome, setOutcome] = useState<{ id: string; status: Exclude<LoadState, 'loading'> } | null>(null);
  const state: LoadState = outcome?.id === businessId ? outcome.status : 'loading';

  // A stale record from the previously opened business must never be read as
  // this one's. Derived, so it is true from the first render after navigation.
  const showingOtherBusiness = Boolean(currentBusiness) && currentBusiness?.id !== businessId;

  useEffect(() => {
    let cancelled = false;

    selectBusiness(businessId);

    fetch(`/api/businesses/${businessId}`)
      .then(async res => {
        if (cancelled) return;
        if (res.ok) {
          setCurrentBusiness(await res.json());
          setOutcome({ id: businessId, status: 'ready' });
        } else {
          // 404 (no such business) and 403 (someone else's) both mean "not
          // yours to view" — do not distinguish them for the viewer.
          setCurrentBusiness(null);
          setOutcome({ id: businessId, status: 'missing' });
        }
      })
      .catch(() => {
        if (!cancelled) setOutcome({ id: businessId, status: 'missing' });
      });

    return () => { cancelled = true; };
  }, [businessId, setCurrentBusiness, selectBusiness]);

  if (state === 'missing') {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="text-4xl">🏚️</div>
        <p className="text-sm text-muted-foreground">
          That business doesn&apos;t exist, or it isn&apos;t one of yours.
        </p>
        <Button asChild variant="outline">
          <Link href={ROUTES.businesses}>Back to Businesses</Link>
        </Button>
      </div>
    );
  }

  // Hold the detail view back until the record on screen is this business's,
  // rather than letting it paint the previous shop's numbers for a frame.
  if (state === 'loading' && showingOtherBusiness) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
    );
  }

  return <BusinessDetail businessId={businessId} />;
}
