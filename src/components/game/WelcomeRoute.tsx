'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import WelcomeScreen from '@/components/game/WelcomeScreen';

/**
 * Messages for the `?auth_error=` codes the Google routes redirect back with.
 * The redirect is a full page load, so there is no response body to read — the
 * code in the URL is the only channel.
 */
const AUTH_ERRORS: Record<string, string> = {
  google_unavailable: 'Google sign-in is not configured on this server yet.',
  google_cancelled: 'Google sign-in was cancelled.',
  google_state: 'That sign-in attempt expired. Please try again.',
  google_unverified: 'That Google account has no verified email address.',
  google_failed: 'Google sign-in failed. Please try again.',
  rate_limited: 'Too many attempts. Please wait a minute and try again.',
};

/** Welcome screen wrapper: surfaces sign-in failures handed back in the URL. */
export default function WelcomeRoute({ googleEnabled }: { googleEnabled: boolean }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('auth_error');
    if (!code) return;

    toast.error(AUTH_ERRORS[code] ?? 'Sign-in failed. Please try again.');

    // Drop the parameter so a refresh does not replay the same error.
    params.delete('auth_error');
    const query = params.toString();
    window.history.replaceState(null, '', query ? `/?${query}` : '/');
  }, []);

  return <WelcomeScreen googleEnabled={googleEnabled} />;
}
