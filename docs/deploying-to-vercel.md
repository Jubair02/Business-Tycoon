# Deploying to Vercel

Written for: whoever is deploying this, including future you.

The app runs on Vercel, but not by default — four things about it assume a
server that stays running, and Vercel does not give you one. This is what was
changed and why, so nobody puts it back.

---

## The clock is the whole problem

A game day is four real hours and the world advances on a server clock. That
clock used to be a `setInterval` started by [`src/instrumentation.ts`](../src/instrumentation.ts)
when the server booted.

**On Vercel that timer dies.** Functions are ephemeral: they wake for a request,
serve it, and freeze. Nothing keeps a loop alive between invocations. Left
alone, the game would deploy cleanly, serve every page, and never advance a
single day.

So on Vercel the clock comes from outside:

```
GAME_TICK_SCHEDULER=off      # stop the in-process loop trying
```

and [`vercel.json`](../vercel.json) schedules the tick instead:

```json
{ "crons": [{ "path": "/api/game/tick", "schedule": "0 */4 * * *" }] }
```

Vercel Cron sends `Authorization: Bearer $CRON_SECRET`, which
[`tick-auth.ts`](../src/lib/game/tick-auth.ts) already understood.

### The trap in that endpoint

Vercel Cron issues a plain **`GET`**, and there is no way to ask it for a
`POST`. The route used to answer a `GET` with a status payload and a 200 — so
the cron dashboard would have shown a healthy green tick every four hours while
the world stayed frozen for ever. Nothing would have alerted; the game would
simply never have moved.

`GET` now advances the world **when the caller proves it is the cron**, and
still returns the harmless status payload to anyone else. A mutating `GET` is
poor HTTP manners. It is also what hosted cron schedulers send, and a frozen
world is worse than an unfashionable verb.

### Cron frequency

Hobby plans restrict how often cron may run. If yours will not accept
`0 */4 * * *`, either upgrade or slow the game to match — set
`GAME_TICK_INTERVAL_MS` to whatever interval you can actually schedule, so a
game day and a cron firing stay the same thing. They must agree, or the world
runs at a speed nobody chose.

`season-coherence.test.ts` checks the clock still makes sense against the season
length, the offline grace and the season pass after any such change.

---

## Standalone output is for self-hosting

`output: "standalone"` builds a self-contained server tree. Vercel builds and
serves the app itself and that tree only gets in the way, so it is now opt-in:

```ts
output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined
```

Running the server directly is still supported:

```bash
npm run build:standalone && npm run start:standalone
```

`npm run build` and `npm start` are now the plain Next.js ones, which is what
Vercel expects.

---

## `prisma generate` has to run on every install

Vercel caches `node_modules` between builds. Without a `postinstall` the cached
Prisma client is reused, so the first schema change after a successful deploy
produces a build that compiles against a client that no longer matches the
database. Added:

```json
"postinstall": "prisma generate"
```

---

## Database

Use Neon's **pooled** endpoint — the host with `-pooler` in it:

```
postgresql://USER:PASS@ep-xxx-pooler.REGION.aws.neon.tech/DB?sslmode=require&pgbouncer=true&connect_timeout=15
```

Every serverless invocation opens its own connection. A direct endpoint runs out
of them under any real traffic; the pooler exists for exactly this shape.

### Before first traffic

`npm run db:push` and check what it intends to do first. There is no
`prisma/migrations/` directory at all (recorded as **U7** in
[`INVARIANTS.md`](../agent-ctx/INVARIANTS.md)) and `db:push` runs with
`--accept-data-loss`. Against a database holding real players, take a Neon
branch or a backup first.

---

## Environment variables

Set these for **Production**, **Preview** and **Development**, except the two
URLs, which differ per environment.

### Required

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string |
| `SESSION_SECRET` | 32+ characters. Production refuses to boot without it, deliberately — a per-process fallback would sign every player out on each cold start |
| `CRON_SECRET` | What Vercel Cron presents. Without it the tick endpoint is closed in production |
| `APP_URL` | `https://your-app.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | Same, exposed to the browser |

### Strongly recommended

| Variable | Notes |
|---|---|
| `GAME_TICK_SCHEDULER` | `off` on Vercel. See above |
| `ANALYTICS_REPORT_TOKEN` | `GET /api/analytics/report` refuses without it rather than opening |
| `GAME_TICK_INTERVAL_MS` | Blank for the 4-hour default. Must agree with the cron schedule |

### Optional — each feature stays off if blank

| Variable | Feature |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in. Password login works without |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web push |
| `PAYMENT_PROVIDER` | `sandbox` settles instantly with no network call |
| `SSLCOMMERZ_STORE_ID` / `SSLCOMMERZ_STORE_PASSWORD` / `STRIPE_SECRET_KEY` | Only if `PAYMENT_PROVIDER` is not `sandbox` |
| `AD_PROVIDER` / `AD_NETWORK_APP_ID` / `AD_SSV_SECRET` | Rewarded video. `none` hides every placement |
| `SPONSOR_REPORT_TOKEN` | Sponsor campaign reports |
| `ANALYTICS_DISABLED` | `1` stops every analytics write |

Generate secrets with `openssl rand -hex 32`, and VAPID keys with
`npx web-push generate-vapid-keys`.

---

## Checking it actually works

```bash
# Unauthenticated: reports the clock without touching it.
curl https://your-app.vercel.app/api/game/tick
# -> {"schedulerEnabled":false,"tickIntervalMs":14400000}

# Authenticated: advances the world, exactly as the cron does.
curl -X POST https://your-app.vercel.app/api/game/tick \
  -H "Authorization: Bearer $CRON_SECRET"
# -> {"success":true,"ticked":true}
```

Then watch `gameDay` climb in `GET /api/game/state` over a few hours. If it does
not move, the cron is not reaching the endpoint — and that is the one failure
this whole setup exists to prevent.
