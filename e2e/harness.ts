// ============================================
// Bangladesh Business Tycoon - End-to-End Harness
// ============================================
//
// Boots a *real* stack for one test run: a real Postgres, the real schema, the
// real Next server, driven over real HTTP. Nothing is mocked.
//
// ---- Why not just point it at the dev database ----
//
// The project's `DATABASE_URL` is a shared Neon instance with live player data
// in it, and a tick advances the game clock for **every** player and every AI
// competitor. A test suite must not write to that, and must not move that
// clock. So the harness brings its own database.
//
// ---- Why PGlite ----
//
// PGlite is Postgres compiled to WASM, served over a local socket. That gives a
// genuine `postgres://` URL — Prisma pushes the whole schema to it unmodified —
// with no Docker, no service container and no installed server. The whole
// database lives and dies with the test process.
//
// ---- Two things that will bite whoever edits this ----
//
// 1. **Never use `spawnSync` here.** PGlite's socket server runs in *this*
//    process, so blocking the event loop means it cannot answer the connection
//    Prisma opens. That surfaces as a completely misleading
//    "P1001: Can't reach database server". Use async `spawn` and await it.
//
// 2. **Never pre-probe the port with a bare TCP connect.** PGlite serves one
//    client at a time; opening and dropping a socket leaves it unable to accept
//    the next one. Retry the real operation instead — that is the readiness
//    signal anyway.

import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn, type ChildProcess, spawnSync } from 'node:child_process';
import net from 'node:net';
import { randomBytes } from 'node:crypto';

export interface ApiResponse<T = any> {
  status: number;
  body: T;
}

export type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

export interface Harness {
  origin: string;
  cronSecret: string;
  /**
   * Issue a request, carrying the session cookie the way a browser would.
   *
   * `body` is widened from `RequestInit`'s BodyInit to anything, because every
   * call site passes a plain object and the harness serialises it.
   */
  api<T = any>(path: string, init?: RequestOptions): Promise<ApiResponse<T>>;
  /** Bearer token for the analytics report endpoint. */
  analyticsToken: string;
  /** Advance the game clock by one day, as an external cron would. */
  tick(): Promise<ApiResponse>;
  stop(): Promise<void>;
  /** Server output, for diagnosing a failure. */
  log(): string;
}

/** An unused local port. */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
}

/** Run a command to completion without blocking the event loop. */
function run(
  command: string,
  args: string[],
  env: Record<string, string>,
): Promise<{ code: number | null; output: string }> {
  return new Promise(resolve => {
    const child = spawn(command, args, { env: { ...process.env, ...env }, shell: true });
    let output = '';
    child.stdout.on('data', d => { output += d; });
    child.stderr.on('data', d => { output += d; });
    child.on('close', code => resolve({ code, output }));
  });
}

/** Kill a process and everything it spawned. `shell: true` means a tree. */
function killTree(child: ChildProcess | null): void {
  if (!child?.pid) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/F', '/T', '/PID', String(child.pid)], { stdio: 'ignore' });
    } else {
      process.kill(-child.pid, 'SIGKILL');
    }
  } catch {
    // Already gone.
  }
}

async function waitFor(check: () => Promise<boolean>, label: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch {
      // Not up yet.
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${label}`);
}

export async function startHarness(): Promise<Harness> {
  const pgPort = await freePort();
  const appPort = await freePort();
  const origin = `http://127.0.0.1:${appPort}`;

  const baseDbUrl = `postgresql://postgres:postgres@127.0.0.1:${pgPort}/postgres`;
  // PGlite serves one client at a time, so the app must not open a pool.
  const appDbUrl = `${baseDbUrl}?connection_limit=1&pool_timeout=30`;

  const cronSecret = 'e2e-cron-secret-0123456789abcdef0123456789abcdef';
  const sessionSecret = 'e2e-session-secret-0123456789abcdef0123456789';
  const analyticsToken = randomBytes(16).toString('hex');

  // ---- Database ----
  const db = await PGlite.create();
  const pgServer = new PGLiteSocketServer({ db, port: pgPort, host: '127.0.0.1' });
  await pgServer.start();

  let push = await run('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
    DATABASE_URL: baseDbUrl,
  });
  for (let attempt = 0; attempt < 3 && push.code !== 0; attempt++) {
    await new Promise(r => setTimeout(r, 1500));
    push = await run('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
      DATABASE_URL: baseDbUrl,
    });
  }
  if (push.code !== 0) {
    await pgServer.stop();
    await db.close();
    throw new Error(`Schema push failed:\n${push.output.slice(-1500)}`);
  }

  // ---- App ----
  let serverLog = '';
  const app = spawn('npx', ['next', 'dev', '-p', String(appPort)], {
    env: {
      ...process.env,
      DATABASE_URL: appDbUrl,
      // The test drives the clock. An in-process scheduler ticking underneath
      // would make every assertion about "after N days" a race.
      GAME_TICK_SCHEDULER: 'off',
      CRON_SECRET: cronSecret,
      SESSION_SECRET: sessionSecret,
      APP_URL: origin,
      // So the journey can read back what it recorded, through the real
      // endpoint rather than by querying the table behind it.
      ANALYTICS_REPORT_TOKEN: analyticsToken,
    },
    shell: true,
  });
  app.stdout?.on('data', d => { serverLog += d; });
  app.stderr?.on('data', d => { serverLog += d; });

  let cookie = '';

  const api = async <T = any>(
    path: string,
    init: RequestOptions = {},
  ): Promise<ApiResponse<T>> => {
    const { body, headers, ...rest } = init;
    const res = await fetch(`${origin}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        // The proxy refuses a mutating request with neither Origin nor
        // Sec-Fetch-Site, so the harness sends what a browser would.
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(headers as Record<string, string> | undefined),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    // Keep the session across requests, replacing rather than appending so a
    // refreshed cookie does not accumulate duplicates.
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const pair = raw.split(';')[0];
      const name = pair.split('=')[0];
      const rest = cookie.split('; ').filter(c => c && c.split('=')[0] !== name);
      cookie = [...rest, pair].join('; ');
    }

    const text = await res.text();
    let parsed: any = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Non-JSON (an HTML page, say) is returned as text.
    }
    return { status: res.status, body: parsed };
  };

  try {
    await waitFor(
      async () => (await fetch(`${origin}/api/game/state`).catch(() => null))?.ok ?? false,
      'the app to serve requests',
      240_000,
    );
  } catch (error) {
    killTree(app);
    await pgServer.stop().catch(() => {});
    await db.close().catch(() => {});
    throw new Error(`${(error as Error).message}\n\nServer output:\n${serverLog.slice(-2000)}`);
  }

  return {
    origin,
    cronSecret,
    analyticsToken,
    api,
    tick: () =>
      api('/api/game/tick', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cronSecret}` },
      }),
    log: () => serverLog,
    stop: async () => {
      killTree(app);
      await pgServer.stop().catch(() => {});
      await db.close().catch(() => {});
    },
  };
}
