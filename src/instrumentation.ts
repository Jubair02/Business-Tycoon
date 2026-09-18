/**
 * Next.js calls this once per server process on startup.
 *
 * It is where the game clock is started — see `lib/game/scheduler.ts`. The
 * import is dynamic and guarded because this file is also loaded for the Edge
 * runtime, which has neither Prisma nor timers suited to a long-running loop.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // `next build` evaluates the server bundle; it must not start ticking the
  // production database while compiling.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const { startTickScheduler } = await import('@/lib/game/scheduler');
  startTickScheduler();
}
