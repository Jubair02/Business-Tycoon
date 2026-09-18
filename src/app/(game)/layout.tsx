import { redirect } from 'next/navigation';
import { getCurrentPlayer } from '@/lib/auth/current-player';
import GameShell from '@/components/game/GameShell';

/**
 * Guard for every in-game route.
 *
 * The check runs on the server before any game screen is sent, so an
 * unregistered visitor who deep-links to /bank is redirected to the welcome
 * screen instead of briefly rendering the game chrome.
 */
export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const player = await getCurrentPlayer();
  if (!player) {
    redirect('/');
  }

  return <GameShell>{children}</GameShell>;
}
