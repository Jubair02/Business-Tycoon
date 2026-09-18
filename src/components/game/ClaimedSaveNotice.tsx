'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * Confirms a guest save was adopted by the account that just signed in.
 *
 * The Google flow finishes as a redirect, so the only way to carry that news
 * into the app is the `?claimed=1` marker on the destination URL. The password
 * flows report it from the API response instead.
 */
export default function ClaimedSaveNotice() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('claimed') !== '1') return;

    toast.success('Your existing progress is now saved to your account.');

    params.delete('claimed');
    const query = params.toString();
    window.history.replaceState(
      null,
      '',
      window.location.pathname + (query ? `?${query}` : '')
    );
  }, []);

  return null;
}
