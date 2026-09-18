import { redirect } from 'next/navigation';
import { getCurrentPlayer } from '@/lib/auth/current-player';
import WelcomeRoute from '@/components/game/WelcomeRoute';
import { isGoogleConfigured } from '@/lib/auth/google';
import { ROUTES } from '@/lib/game-routes';

/**
 * Welcome / sign-in screen.
 *
 * A visitor who is already signed in never sees this: the redirect happens on
 * the server, so there is no flash of the welcome screen before the dashboard.
 */
export default async function Home() {
  const player = await getCurrentPlayer();
  if (player) {
    redirect(ROUTES.dashboard);
  }

  return <WelcomeRoute googleEnabled={isGoogleConfigured()} />;
}
