# Bangladesh Business Tycoon — Comprehensive Project Report

**Prepared:** 18 September 2026
**Repository:** `Business Tycoon` (branch `main`)
**Scope:** Business model, product, architecture, implementation state, risk, and roadmap

---

## 1. Executive Summary

Bangladesh Business Tycoon is a browser-based, server-authoritative business simulation game set in Bangladesh. Players start with ৳500,000, open one of five business types across five cities and fourteen named neighbourhoods, then manage inventory, pricing, staffing, marketing campaigns, loans and expansion while competing against eight AI-controlled rivals on a shared leaderboard.

The codebase is substantially built: **34,854 lines** across **182 TypeScript files**, **39 API routes**, **13 pages**, **18 Prisma models**, **407 passing unit tests**, and a clean TypeScript compile. Five development "phases" (economy, AI competitors, customer experience, marketing, expansion) are implemented end to end, with authentication (email/password + Google OAuth) layered on top.

**The verdict is: strong engineering foundations, an unfinished game loop, and no business model yet.**

Three findings blocked launch outright. **All three are now fixed** (see section 7):

1. ~~**Player level never increases**~~ — **FIXED.** A progression system (`src/lib/game/progression/`) now awards XP for profitable days, upgrades, new businesses, first profit and cleared loans, and levels the player on the `level x 1000` curve the UI already rendered. Expansion, the Portfolio screen and the multi-business achievements are reachable for the first time.
2. ~~**Daily profit is counted twice**~~ — **FIXED.** The tick now sweeps the business till to the player instead of mirroring profit into both rows, so net worth grows by exactly what was earned.
3. ~~**The game clock is driven by the browser**~~ — **FIXED.** The world now advances on a server-owned clock started from `instrumentation.ts`. `/api/game/tick` is a service entrypoint authenticated by `CRON_SECRET`, not a player action, and the client only polls for the day to change.

Three further defects have also been closed: opening stock is now charged for rather than gifted (which had made a buy-then-liquidate loop mint free cash); the sell-business path returns the till instead of deleting it; and `location` is validated and cross-checked against the submitted city, closing an exploit where a business could take one city's market prices while sitting on another city's footfall and rent.

Beyond these, business-type return-on-investment is imbalanced by roughly 8×, there is no monetisation, no server-side integration testing, and the working tree remains uncommitted.

None of this is unusual for a project at this stage. The build quality — structured errors, HMAC-signed sessions, scrypt password hashing, transactional writes, a tick concurrency lock with stale-lock recovery — is genuinely above average. The gap is between *systems built* and *systems connected into a finished, monetisable loop*.

---

## 2. Product & Business Model

### 2.1 Current positioning

| Dimension | Current state |
|---|---|
| Genre | Idle / management tycoon simulation |
| Setting | Bangladesh — Dhaka, Chattogram, Sylhet, Rajshahi, Khulna |
| Platform | Responsive web (mobile-first, desktop supported) |
| Session model | Persistent save, shared world, asynchronous play |
| Audience | Bangladeshi and diaspora casual/strategy players; secondary use as business-literacy edutainment |
| Monetisation | **None implemented** |
| Pricing | **None** |
| Revenue to date | ৳0 |

### 2.2 The differentiator

The cultural specificity *is* the moat. Generic tycoon games are abundant; a game that models Gulshan rents against Old Dhaka footfall, prices tea at ৳8, runs Eid and Puja demand spikes, and denominates everything in taka with lakh/crore formatting is not. The location system (`src/lib/game/expansion/expansion-config.ts`) encodes fourteen real neighbourhoods with distinct rent, footfall, competition and suitability profiles — that's authentic domain content a competitor cannot trivially copy.

The second differentiator is simulation depth. Most casual tycoon games use a single "revenue per second" number. This one runs a layered demand model: base customers → location modifier → reputation → stock availability → staffing → customer-experience modifier → segment mix → marketing lift → brand awareness → setup penalty, then per-product price-elasticity sales against a fluctuating market price. That depth supports a genuinely strategic game.

### 2.3 Monetisation options (built; not yet switched on)

Ranked by fit:

**Tier 1 — recommended first**
- **Cosmetic and identity**: shop skins, city-themed storefronts, custom signage, profile frames. Zero balance impact, zero pay-to-win perception.
- **Battle-pass / seasonal track**: a 30-day season with free and premium reward lanes. Fits the existing game-day counter and drives retention, not just ARPU.

**Tier 2 — after balance is fixed**
- **Convenience, not power**: extra business slots beyond 5, additional auto-tick speed, an "auto-restock" manager that automates the current daily restock chore, offline progression catch-up.
- **Rewarded video** for a one-off inventory delivery or a reputation nudge. High fill rates in the Bangladesh market; low friction.

**Tier 3 — strategic**
- **Sponsored in-game brands**: real FMCG or telco brands as purchasable inventory lines or campaign channels. Directly monetises the authenticity advantage, and is the highest-ceiling option in this market where consumer IAP spend is low.
- **Education licensing**: a classroom edition for business schools and BBA programmes, sold per-seat. The simulation already models COGS, gross margin, working capital, loan amortisation, NPS and CAC.

**Explicitly avoid:** selling cash or net worth directly. The leaderboard is the retention engine; making it purchasable destroys it.

**Status.** Tier 1 and Tier 2 are implemented (§Phase D 27–28): catalogue, entitlements, season pass, rewarded video, all behind provider interfaces with a sandbox that settles without charging. Tier 3 has its systems built but neither a partner nor an institution signed (§Phase D 29–30).

Two of the options listed above were rejected on inspection rather than built, and the list above is left unedited so the reasoning is visible:

- **"Additional auto-tick speed"** — the clock is now server-owned and shared. There is no per-player tick speed to sell, and there should not be: a player who bought a faster clock would be buying more simulated days than the person they are ranked against.
- **"Offline progression catch-up"** and **"a one-off inventory delivery"** — both sell simulated output. On a ladder measured in net worth that is pay-to-win however it is packaged. Rewarded video pays out cosmetic-track progress instead.

### 2.4 Unit economics to establish

None of these are currently instrumented. Before any monetisation decision, the game needs to report: D1/D7/D30 retention, average session length, ticks per session, day-7 net worth distribution, bankruptcy rate, and the funnel from welcome screen → account created → first business opened → first profitable day.

---

## 3. Core Features (implemented)

### 3.1 Business operations
- **Five business types** — Tea Stall (৳50k), Grocery (৳300k), Clothing (৳500k), Restaurant (৳800k), Mobile & Electronics (৳1M) — each with distinct margin targets, price sensitivity, volatility, growth ceiling and rent scaling (`business-config.ts`).
- **28 products** across the five types, each with base price, base demand, max stock, suggested markup, price sensitivity and volatility.
- **Inventory**: buy at market price, set individual sell prices, liquidate at 70% of cost.
- **Staffing**: five roles (Cashier, Salesperson, Manager, Cleaner, Delivery Rider) with skill and efficiency ratings feeding service quality and reputation.
- **Upgrades**: business levels 1–10, cost `investment × level × 0.5`, each level adding customers, rent and utilities.
- **Sale/exit**: sell a business back for 50–80% of investment scaled by reputation, plus 70% inventory liquidation.

### 3.2 Economy simulation
- **Price elasticity**: demand decays exponentially against the ratio of the player's price to market reference price, modulated per product and per business type.
- **Market prices**: per product, per city, updated every third tick with 70% retention blending plus persistent event effects.
- **Expenses**: rent (monthly, scaled by level and location), salaries (monthly ÷ 30), utilities, and tax (10% of gross profit with a 2% revenue floor).
- **Reputation**: gains from profitability, managers and cleaners; losses from stockouts and unprofitability; natural decay.
- **Health score**: weighted composite of profitability (35%), inventory (25%), cash flow (20%), reputation (20%).
- **Random events**: ten weighted templates — Ramadan, Eid, Puja, cricket matches, floods, dollar-rate shifts, supply-chain disruption, iPhone launches, admissions season, economic boom — each with typed effects and durations.

### 3.3 AI competitors
Eight named AI players (Rahim Enterprises, Fatima Holdings, Khan & Sons, …) with five personalities — Conservative, Balanced, Aggressive, Trader, Expansionist. Each tick they restock critically low inventory, then score and execute one strategic action from eight options (buy inventory, change price, hire, upgrade, create business, take loan, repay loan, hold) under personality-specific cooldowns, cash reserves and eagerness. They also run marketing campaigns. Their moves generate news headlines.

### 3.4 Customer experience
- **Satisfaction** from five weighted factors: price competitiveness (30%), product quality (25%), service quality (20%), stock availability (15%), atmosphere (10%), smoothed across days.
- **Four customer segments** — Budget (40%), Regular (30%), Premium (20%), Tourist (10%) — with distinct sensitivities.
- **Loyalty tiers** Bronze → Platinum, with repeat-customer rate and demand multipliers.
- **NPS** computed from generated 1–5 star reviews.
- **Review generation**: probabilistic, templated by sentiment and category (price, service, quality, stockout, cleanliness, wait time), pruned to the last N per business.

### 3.5 Marketing
Six channels — Social Media, Facebook Ads, Local Advertising, Influencer, Billboard, TV/Media — each with cost, reach-per-taka, conversion rate, segment affinity, diminishing-returns exponent and level gate. Campaigns have budgets, durations, optional segment targeting, daily metric tracking, effectiveness scoring and revenue attribution. Brand awareness accumulates from reach and decays without spend.

### 3.6 Expansion & locations
Fourteen locations across five cities with rent, customer, competition, growth-potential and operating-cost modifiers plus suitable/unsuitable business-type lists. Expansion cost scales 40% per business owned, with a setup period during which revenue runs at 30%, a 7-day cooldown and a 15% cash-reserve requirement. *Currently unreachable — see §7.1.*

### 3.7 Supporting systems
Banking (up to 3 concurrent loans at 5%, capped at `level × ৳200,000`, daily auto-deduction), leaderboards (net worth / profit / revenue / market share, city-filterable), 12 achievements, a news feed, a daily-summary modal, a notification centre, a tutorial overlay, contextual hints, light/dark theming, and a settings screen with auto-tick speed and game reset.

---

## 4. User Roles

The system recognises three principals. There is **no administrative role of any kind**.

| Role | How identified | Capabilities |
|---|---|---|
| **Anonymous visitor** | No session cookie | Welcome screen, sign-up, sign-in, `POST /api/game/init` (seeding) |
| **Authenticated player** | `bt_session` cookie → `AuthSession` → `User` → `Player` | Full game; owns exactly one save; can advance the global clock |
| **AI competitor** | `Player.isAI = true`, `userId = null` | Engine-owned; no login; acts only inside the tick |
| **Legacy guest** | Signed `playerId` cookie (deprecated) | Save is adopted on first sign-in, then the cookie is expired |

**Gap:** no admin or operator role. There is no way to inspect a player, correct a broken save, ban an abuser, adjust live balance constants, or trigger a tick without impersonating a player. For a live service this is a day-one operational requirement.

---

## 5. Key Workflows

**Onboarding.** Visitor lands on `/` → Welcome screen → sign up with email/password or Google → `ensurePlayerForUser()` creates a `Player` with ৳500,000 (adopting any legacy guest save in that browser) → redirect into the game → tutorial overlay appears while zero businesses exist.

**Opening a business.** Five-step wizard (`NewBusiness.tsx`): type → city → location → name → confirm. The server re-checks max businesses, cooldown, level, affordability and cash reserve, deducts the scaled expansion cost, creates the business with a setup period, and seeds 40% starting stock.

**The daily loop.** Player reviews the dashboard → opens a business → restocks depleted inventory → adjusts prices against the pricing-advice endpoint → hires or fires staff → launches or tunes a marketing campaign → presses **Next Day** → a daily-summary modal shows deltas.

**A tick.** `POST /api/game/tick` → require session → rate limit (30/min) → acquire the serializable tick lock → expire events, increment `gameDay`, 20% chance of a new event, market prices every 3rd tick → simulate every business sequentially → process loan payments → run the AI tick → 50% chance of news → release lock.

**A single business simulation.** CX demand modifier (previous tick) → segment demands → marketing processing → potential customers → per-product elastic sales → expenses → net profit → reputation → health score → satisfaction/loyalty → one transaction writing inventory, business, player cash, campaign attribution, daily metric, log, reviews, NPS, review pruning and net-worth recalculation.

**Borrowing.** Bank screen → choose amount (≤ `level × ৳200,000`) and term → transactional creation with a 3-loan cap → cash credited, net worth unchanged → daily payments deducted automatically until cleared.

---

## 6. System Architecture

### 6.1 Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, `output: standalone`), React 19 |
| Language | TypeScript 5 (strict, `noImplicitAny: false`) |
| Styling | Tailwind CSS 4, shadcn/ui on Radix (48 primitives), Framer Motion |
| Client state | Zustand |
| Charts | Recharts |
| Database | PostgreSQL (Neon) via Prisma 6 |
| Auth | Bespoke — scrypt passwords, HMAC-signed cookies, SHA-256 session tokens, Google OAuth |
| Validation | Zod 4 |
| Tests | Vitest (407 tests) |
| Runtime | Bun; Caddy reverse proxy on :81 → :3000 |

### 6.2 Layering

```
src/app/(game)/*          Route group — server-guarded game screens
src/app/api/*             39 route handlers (the entire server API)
src/components/game/*     28 feature components
src/components/ui/*       48 shadcn primitives
src/lib/game-engine.ts    Tick orchestration (1,441 lines)
src/lib/game/
  economy/                Formulas, configs, CX, product demand, balance sim
  ai/                     Engine, strategy, evaluation, actions, marketing
  marketing/              Channels, formulas
  expansion/              Locations, eligibility, cost
src/lib/auth/*            Sessions, passwords, Google, account↔save linking
src/lib/errors/*          AppError, handlers, Zod schemas
src/store/game-store.ts   Zustand store
prisma/schema.prisma      18 models
```

This separation is the project's best structural decision. Pure formula modules take plain inputs and return plain outputs, with all configuration as exported constants. That is exactly why 407 unit tests exist and run in 542 ms — and why the economy can be rebalanced without touching the engine.

### 6.3 Data model

18 models in three clusters:

- **Identity**: `User`, `OAuthAccount`, `AuthSession`, `Player`
- **Game entities**: `Business`, `Inventory`, `Employee`, `Product`, `MarketPrice`, `Loan`
- **World and telemetry**: `GameState` (key-value, holds the tick lock and game day), `GameEvent`, `GameLog`, `NewsArticle`, `BusinessMetric`, `CustomerReview`, `MarketingCampaign`, `CampaignMetric`

Indexing is reasonable. The `Player`/`User` split is a good call — it lets a player change how they sign in without touching progress.

### 6.4 Concurrency control

The tick lock (`acquireTickLock`, `game-engine.ts:98`) runs read-then-write under `Serializable` isolation, translating Prisma's P2034/P2028 conflict codes into "someone else holds the lock", with 2-minute stale-lock recovery. The code comments record that Read Committed previously allowed double-processing. This is a well-reasoned fix.

---

## 7. Critical Findings

These are verified against the code, not inferred.

### 7.1 Player level is permanently 1 — expansion is dead code ✅ FIXED

`Player.experience` is never incremented anywhere in `src/`. `Player.level` is never incremented either — the only `level: { increment: 1 }` in the codebase targets `Business`, not `Player` (`ai-actions.ts:329`).

`EXPANSION_CONFIG.minLevelForSecondBusiness = 2` (`expansion-config.ts:297`), enforced in both `checkExpansionEligibility()` (`expansion-formulas.ts:119`) and `POST /api/businesses` (`businesses/route.ts:80`).

**Consequence:** every player is capped at one business, forever. The Portfolio screen, expansion cost scaling, setup periods, location suitability strategy, the "Business Mogul", "Diversified" and "National Presence" achievements, and multi-business leaderboard competition are all unreachable. The dashboard shows a permanent `0 / 1000 XP` bar (visible in `download/qa-final-dashboard.png`).

This was the single highest-value fix in the project: one missing subsystem invalidated an entire development phase.

**Resolved.** `src/lib/game/progression/` is now the sole owner of `Player.level` and `Player.experience`. XP comes from profitable business days (a flat base plus a logarithmic profit bonus, so a 48× profit spread compresses to under 3× in levelling speed), plus one-off milestones for a business's first profit, upgrades, openings and cleared loans. Every source is idempotent by construction — a discrete event or a one-way state transition — so no new tables were needed. AI competitors progress on identical rules, and `recalculateAINetWorth` no longer overwrites level from net-worth brackets. From profitable days alone, a Tea Stall reaches the second-business gate around day 19 and a Clothing shop around day 8; milestone XP and additional businesses make this faster in practice.

### 7.2 Profit is double-counted into net worth ✅ FIXED

In `simulateBusinessTick` (`game-engine.ts:828` and `:845`):

```ts
await tx.business.update({ data: { cash: business.cash + roundTaka(dailyProfit), … } });
await tx.player.update({  data: { cash: { increment: roundTaka(profitToDistribute) } } });
```

`profitToDistribute === dailyProfit`. The comment above it says profit "is transferred to the player each tick" — but the business's cash is *incremented*, not zeroed. Since `recalculateNetWorth()` sums `player.cash + Σ business.cash + inventory − debt` (`game-engine.ts:200`), every taka of profit is counted twice.

**Consequence:** net worth grows at roughly 2× the true rate; the net-worth leaderboard, the Millionaire/Crorepati achievements, and the 15% cash-reserve expansion gate are all computed on inflated figures. Losses are also doubled, so a failing business fails twice as fast.

**Resolved.** The till is now swept: the business is written back at `cash: 0` and the player is credited `business.cash + dailyProfit`. Sweeping the *existing* balance as well as the day's profit also drains the stranded balances older saves accumulated — money that was already inside their net worth but unreachable — so the transfer moves it without changing the total.

Two consequences are worth noting. The health score's cash-flow factor (20% weight) previously read a till that no longer exists, so it is now measured against the owner's cash, which is the liquidity that actually funds a shop's rent and restocking. And the offline balance harness (`ai-simulation-test.ts`) carried the identical double-count and has been corrected too — past balance tuning done with it was working from inflated numbers.

**Not addressed:** this stops future double-counting but does not retroactively correct net worths already inflated by it. Existing saves need a one-off backfill, which requires database access.

### 7.3 The game clock is client-driven ✅ FIXED

There is no cron job, no scheduled function, no background worker. `POST /api/game/tick` is called from a browser `setInterval` in `GameShell.tsx:216` (30s/60s/120s depending on the player's auto-tick setting) and from the **Next Day** button.

**Consequences:**
- **Fairness:** the world advances only when someone is looking at it, and any one player's setting determines the pace for everyone — including all eight AI competitors.
- **Abuse:** the rate limit is 30 ticks/minute per IP, in-memory and per-process. A player rotating IPs, or simply opening several tabs, advances the shared world far faster than others.
- **Scale:** once the world has many businesses, a tick will exceed any HTTP request timeout, and the lock will be perpetually contended.

**Resolved.** The clock is now owned by the server:

- `src/lib/game/scheduler.ts` runs the loop, started once per process from `src/instrumentation.ts`. It uses chained timeouts rather than `setInterval`, so a tick that outlasts its interval is never queued on top of itself, and it survives a failing tick rather than dying with it.
- `/api/game/tick` is now a service entrypoint authenticated by a `CRON_SECRET` bearer token, with no player session path at all. Without the secret configured it is refused outright in production. It exists so an external cron can drive the world instead (`GAME_TICK_SCHEDULER=off`); the in-process clock calls `gameTick()` directly and never goes through HTTP.
- The client no longer ticks. `GameShell` polls `/api/game/state` every 10s and reacts when the day changes — snapshotting the businesses, refreshing, and showing the daily summary exactly as before.
- The "Next Day" button is gone, replaced by a live countdown to the next day. The per-player auto-play speed control in Settings is likewise replaced by a read-only world-clock panel, because the pace is no longer a per-player setting.

Interval and on/off are configured via `GAME_TICK_INTERVAL_MS` (clamped to 5s–1h; an unparseable value falls back to 60s rather than freezing the game) and `GAME_TICK_SCHEDULER`. All three are documented in `.env.example`.

**Deployment note:** the clock is in-process, so it only runs where the Next.js server runs. The existing DB tick lock already makes it safe for more than one instance to have it enabled — the losers simply skip. `start-server.sh` currently runs `bun run dev`; that should be `bun run start` for a production deployment.

### 7.4 Free starting inventory is an arbitrage loop ✅ FIXED

`POST /api/businesses` seeds 40% of max stock for every product **without charging the player** (`businesses/route.ts:131–148`). `POST /api/businesses/[id]/inventory/sell` pays 70% of purchase price. A player can open a business, immediately liquidate the free stock for cash, and sell the business back for 50–80% of investment.

For a Mobile shop the free stock is worth roughly ৳444,000 at cost — about ৳311,000 on immediate liquidation. Combined with the expansion-cost scaling that the player pays, the loop is not infinitely profitable today, but it is an unpriced grant that will interact badly with any future balance change.

**Resolved.** Opening stock is now priced at wholesale and folded into `calculateExpansionCost`, so the affordability check, the cash-reserve check, the eligibility endpoint and the wizard's cost breakdown all agree with what is actually debited. The rows are written inside the payment transaction, which also closes a second bug: a failure part-way through previously left a paid-for business with empty shelves. The AI buys its shelves on the same terms.

Immediate liquidation now loses money for every business type, as the 30% liquidation haircut intends:

| Business | Premises | Opening stock | Total | Liquidation round trip |
|---|---:|---:|---:|---:|
| Tea Stall | ৳57,500 | ৳4,860 | ৳62,360 | −৳1,320 |
| Grocery | ৳345,000 | ৳31,080 | ৳376,080 | −৳9,324 |
| Clothing | ৳575,000 | ৳79,200 | ৳654,200 | −৳23,760 |
| Restaurant | ৳920,000 | ৳19,600 | ৳939,600 | −৳5,820 |
| Mobile | ৳1,150,000 | ৳444,400 | ৳1,594,400 | −৳133,320 |

Day-one affordability is unchanged: Tea Stall and Grocery remain the only types openable from ৳500,000, exactly as before.

### 7.5 Business cash is destroyed on sale ✅ FIXED

`POST /api/businesses/[id]/sell` credits `sellPrice + inventoryValue` but never returns `business.cash`, then deletes the row. Any accumulated till balance is silently lost.

**Resolved.** With the till swept every tick (7.2) this was already almost unreachable, but the route now returns the balance rather than deleting it with the row — a business sold before it has ever ticked, or one on a pre-sweep save, can still be holding money. The balance is floored at zero: a negative till only exists on pre-sweep saves, where the loss already came out of the player's own cash, so charging for it again on the way out would bill them twice.

### 7.6 Unvalidated `location` input ✅ FIXED

`createBusinessSchema` does not include `location`; the route reads it via `(body as Record<string, unknown>).location` (`businesses/route.ts:39`). An arbitrary string is persisted. It fails safe — unknown ids fall through to neutral modifiers — but it is unvalidated user input reaching the database and should be a Zod enum over the 14 known ids.

**Resolved**, and the problem was larger than it looked. `location` is now validated against the 14 known ids *and* cross-checked against the submitted city, because a location **supersedes** its city for both demand and rent (`calculateLocationDemandModifier`, `calculateLocationRentModifier`). A mismatched pair therefore let a player take one city's market prices while sitting on another city's footfall and rent, and left the city spread, the city leaderboard filter and the multi-city achievement reporting a city the business is not in. The route now destructures the parsed result instead of casting around the schema. The wizard already clears the location whenever the city changes, so the happy path is unaffected.

---

## 8. Economy & Balance Analysis

I ran the shipped formulas directly to compute day-1 steady-state P&L for each business type in Dhaka, with no staff and 40% stock:

| Business | Investment | Customers | Revenue | COGS | Expenses | **Net/day** | **Payback** |
|---|---:|---:|---:|---:|---:|---:|---:|
| Tea Stall | ৳50,000 | 97 | ৳5,084 | ৳3,212 | ৳1,087 | **৳785** | **64 days** |
| Grocery | ৳300,000 | 60 | ৳35,116 | ৳29,870 | ৳2,652 | **৳2,594** | **116 days** |
| Clothing | ৳500,000 | 47 | ৳113,300 | ৳79,200 | ৳5,710 | **৳28,390** | **18 days** |
| Restaurant | ৳800,000 | 58 | ৳26,703 | ৳17,370 | ৳3,933 | **৳5,400** | **148 days** |
| Mobile | ৳1,000,000 | 36 | ৳495,080 | ৳444,000 | ৳13,452 | **৳37,628** | **27 days** |

**The curve was inverted and the spread was ~8×.** Clothing paid back in 18 days; Restaurant took 148. Grocery and Restaurant — two of the five types — were strictly dominated and would simply have gone unplayed. The labels made it worse: Clothing was tagged *Medium risk / Medium difficulty / High profit* while returning the best ROI in the game, and Restaurant was tagged identically while returning the worst.

### 8.1 After the rebalance ✅ FIXED

Solved against the same formulas through `balance-sim.ts`, at full stock in Dhaka (the condition auto-restock now makes normal):

| Business | Investment | Footfall | Revenue | COGS | Expenses | **Net/day** | **Payback** |
|---|---:|---:|---:|---:|---:|---:|---:|
| Tea Stall | ৳50,000 | 136 | ৳6,255 | ৳3,985 | ৳417 | **৳1,853** | **27 days** |
| Grocery | ৳300,000 | 186 | ৳86,434 | ৳73,774 | ৳2,679 | **৳9,982** | **30 days** |
| Clothing | ৳500,000 | 119 | ৳61,201 | ৳42,702 | ৳3,350 | **৳15,149** | **33 days** |
| Restaurant | ৳800,000 | 152 | ৳76,968 | ৳50,076 | ৳4,689 | **৳22,203** | **36 days** |
| Mobile | ৳1,000,000 | 67 | ৳299,539 | ৳265,571 | ৳8,141 | **৳25,827** | **39 days** |

Every type lands in the 25–45 day band, the spread is down to 1.4×, and the ladder is deliberate: as the investment rises the absolute profit rises and the ROI gets slightly worse, so progression is about scale rather than about finding the one correct answer. `src/__tests__/business-balance.test.ts` re-runs this end to end and fails if it drifts.

The band describes an *uncontested* market. A shop facing rivals earns its share of the trade rather than all of it (§8.2), so a contested payback is longer by design.

**Structural issues, resolved:**

- ~~**Utilities dwarf rent for small businesses.**~~ **FIXED** — utilities are a monthly bill in `BUSINESS_TYPES.utilities`, beside `rent`, divided by 30 at tick time. The tea stall's ৳22,500/month electricity is ৳1,200.
- ~~**Revenue scales with inventory value, not with customers.**~~ **FIXED** — the runaway came from basket sizes, not from the formula: a clothing customer was buying 3.9 garments a day and 30% of mobile-shop visitors were buying a ৳120,000 handset. Baskets are now 0.45 items for Clothing and 0.34 for Mobile, with shelf space set so a fully stocked shop is limited by demand rather than by its shelves. A day's restocking is now bounded to a third of the investment, so a shop can fund its own float.
- ~~**Restocking is unmodelled tedium.**~~ **FIXED** — players have standing restock orders and a bulk restock action (§13).
- **Loans are nearly free.** 5% flat total interest (not annualised) on a loan repaid over a player-chosen term is close to free money. Still open — though the cap is now meaningful, since `level × ৳200,000` moves with a levelling system that works.

### 8.2 Competition is now a mechanic, not a screen

Nothing in `simulateBusinessTick` used to read a rival's price: two shops of the same trade on the same street sold to two independent pools of customers. Undercutting a rival won nothing and being undercut cost nothing, which is also why the AI ignoring the player did not matter — there was nothing to compete over.

Shops in the same city and trade now draw on one pool, split by price and reputation (`economy/competition.ts`). A second, evenly matched shop costs each of them about 23% of their trade; a rival pricing 15% under takes a further slice on top. A shop can never lose more than 65% of its trade to rivals, nor win more than 25% by being the best shop on the street, so a market can be fought over without being winner-takes-all. The Competition screen reports the same split the simulation uses.

---

## 9. Scalability

**Current ceiling: roughly a few dozen concurrent players.**

| Constraint | Detail |
|---|---|
| Tick is O(all businesses), sequential | `gameTick()` fetches *every* business and awaits `simulateBusinessTick` one at a time (`game-engine.ts:1108`). Each iteration issues ~6 queries plus a transaction with N inventory updates, review inserts and a **per-row delete loop** for review pruning. |
| No horizontal scale | Tick lock lives in a DB row, which is fine; but the rate limiter is an in-process `Map` (`rate-limit.ts`), so limits multiply by instance count. |
| Client polling | Every client re-fetches 7 endpoints every 30 seconds *and* after every tick. `/api/player` returns the full player row with all businesses; `/api/leaderboard` loads 50 players with all their businesses and sorts in memory. |
| Single shared world | One `gameDay`, one event set, one market-price table for all players. Cannot be sharded without a world/season concept. |
| Leaderboard | `take: 50` then in-memory sort — the rankings are wrong as soon as there are more than 50 players. |
| No caching | No Redis, no HTTP cache headers, no ISR. Every request hits Postgres. |
| Review pruning | Deletes rows one at a time in a loop inside the tick transaction (`game-engine.ts:918`). |

**Path to scale:**
1. Move the tick to a scheduled worker; batch businesses and process them in bounded-concurrency chunks.
2. Replace the per-row delete loop with a single `deleteMany`.
3. Move rate limiting to Redis or Postgres.
4. Replace 30-second polling with Server-Sent Events or WebSockets pushed from the tick.
5. ~~Introduce **seasons/worlds**~~ **DONE** — a season owns its own `gameDay` and cohort (§Phase D 24). `GameState.gameDay` no longer exists.
6. Materialise the leaderboard into a table refreshed once per tick. *(Still outstanding, but much less urgent: every board is now scoped to one season's cohort, so `take: 50` is no longer wrong the moment there are fifty-one accounts in the world — only if there are fifty-one in the season.)*

---

## 10. Security

### What is done well

- **Passwords**: scrypt (N=16384, r=8, p=1) with per-password salt and self-describing parameters, `timingSafeEqual` comparison (`auth/password.ts`).
- **Sessions**: 256-bit random token in an `httpOnly`, `sameSite=lax`, `secure`-in-production cookie; only its SHA-256 is stored, so a database dump yields no usable sessions. Sliding expiry, revocable, revoke-all on password change.
- **Login hardening**: a decoy hash is verified when the email is unknown, so response timing does not reveal registered addresses; one generic error message for both failure modes.
- **Account-takeover guard**: signing up with an email that belongs to a Google-only account is refused rather than attaching a password.
- **Leaderboard**: exposes `publicPlayerRef()` — an HMAC-derived opaque id — rather than real player ids.
- **Secrets**: production refuses to start without a ≥32-char `SESSION_SECRET`.
- **Ownership checks**: business-scoped routes verify `business.playerId === playerId` before acting.
- **Headers**: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` set in `next.config.ts`.
- **Transactions**: money-moving operations are wrapped in `db.$transaction` with in-transaction re-reads to close race windows.

### Gaps

| Severity | Issue |
|---|---|
| ~~High~~ | ~~**No CSRF protection.**~~ **FIXED.** `src/middleware.ts` now checks every mutating request to `/api/*` before it reaches a handler: `Sec-Fetch-Site` where the browser provides it, falling back to comparing `Origin` against the served host plus `APP_URL`. A mutating request with neither header is refused. `/api/game/tick` is exempt because cron sends no `Origin` — it is authenticated by its bearer secret instead. |
| **High** | **Rate limiting is per-process and IP-keyed via spoofable `x-forwarded-for`.** Acknowledged in the file's own comments. Ineffective behind the Caddy proxy across restarts or instances. |
| **Medium** | **No email verification.** `User.emailVerified` exists and is never set. Anyone can register any address. |
| **Medium** | **No password reset flow.** A locked-out player has no recovery path. |
| **Medium** | **`/api/player` returns the full player row**, including `email` and the raw `Player.id`. |
| **Medium** | **`/api/game/init` is unauthenticated** and triggers seeding. It short-circuits cheaply after the first run, but it is an unauthenticated write endpoint. |
| **Medium** | **No audit trail for account actions** — sign-ins, password changes and session revocations are not logged. |
| **Low** | No CSP header. No account lockout after repeated failures (only the IP rate limit). No dependency scanning in CI. |
| **Low** | `.env` is tracked as deleted in git status — confirm no secret was ever committed; if it was, rotate. |

---

## 11. UI / UX

### Strengths
- **Mobile-first and considered.** The bottom navigation was deliberately reworked into a 5-column, 2-row grid because ten destinations needed 455px and two were falling off a 360px screen — the reasoning is recorded in the component. Touch targets are held at ≥44px.
- **Persistent shell.** `GameShell` lives in the route-group layout, so polling timers and tick state survive navigation.
- **Server-side route guard.** `(game)/layout.tsx` resolves the player on the server and redirects before any game chrome renders — no flash of authenticated UI.
- **Onboarding**: welcome screen, tutorial overlay while zero businesses exist, and a contextual hint bar.
- **Feedback**: daily-summary modal with deltas, toast notifications, skeleton loading states, Framer Motion page transitions.
- **Localisation touches**: taka formatting with lakh/crore, Bangla city and locality names alongside English.
- **Theming**: light/dark via `next-themes`, with a documented design system at `design-system/business-tycoon/MASTER.md`.

### Weaknesses
- ~~**Ten top-level destinations** is a lot.~~ **FIXED** — six sections, with the four overlapping screens folded in as tabs. No route was removed.
- **A permanently empty XP bar** on the dashboard reads as a broken feature to the player (§7.1).
- ~~**Restocking tedium**~~ **FIXED** — per-shop standing orders run by the tick, plus a "Restock all" bulk action.
- ~~**No i18n framework.**~~ **FIXED, partially applied** — typed catalogues, `Intl`-driven plurals and Bengali numerals, locale resolved server-side (§Phase D 25). The infrastructure is complete; most screen bodies still have English strings inline and need moving into the catalogue.
- **Accessibility unverified.** Radix primitives give a good baseline, but there is no automated a11y check, no keyboard-navigation test, and colour contrast is unaudited.
- ~~**13 lint errors in `src/`**~~ **FIXED** — `eslint .` reports zero errors and zero warnings. Each was fixed at the source rather than suppressed: media queries and carousel bounds moved to `useSyncExternalStore`, derived values moved out of effects into render, fetch-driven writes moved into promise callbacks, and the memoisation errors resolved by closing over primitives instead of whole objects.
- ~~**`BusinessDetail.tsx` is 1,729 lines**~~ **FIXED** — a 660-line shell plus seven tab components sharing one context. `MarketingView.tsx`, at 883 lines, is still outstanding.
- **No empty/error states audit**: network failures in `GameShell` are swallowed silently (`catch { /* silent */ }`), so a player on a flaky connection sees stale data with no indication.

---

## 12. Operational Readiness

| Area | State |
|---|---|
| CI/CD | **None.** No workflow files. Build, lint, type-check and tests are manual. |
| Deployment | `output: standalone` + a bash `start-server.sh` + Caddy on :81. No container, no IaC, no rollback procedure. |
| Migrations | `db:push --accept-data-loss` is the documented path; `prisma/migrations/` does not exist. **There is no migration history** — schema changes cannot be reviewed, replayed or rolled back. |
| Monitoring | **None.** No Sentry, no APM, no uptime check, no structured logging. Errors go to `console.error`. |
| Analytics | **None.** No product analytics of any kind. |
| Backups | Relies on Neon defaults; no documented policy or restore drill. |
| Secrets | `.env` file; `.env.example` is well documented. No secret manager. |
| Testing | 513 unit tests over pure formulas, schemas, the scheduler loop and the CSRF check. **Zero API/integration tests, zero E2E tests, zero database tests.** The game engine, all 39 routes, and the entire auth system are untested end to end. |
| Version control | **341 uncommitted changes** in the working tree, including the whole `(game)` route group, the entire auth system, and 18 new files. Weeks of work exist only on one machine. |
| Documentation | Good internal code comments and `agent-ctx/` phase records. **No README.** No API docs, no runbook, no architecture diagram. |
| Dead code | `z-ai-web-dev-sdk` is a declared dependency with zero imports. `applyEventEffects()` and `simulateAITick()` are no-op shims. `mini-services/` and `db/` are empty. `tool-results/` and `dev.log` (119 KB) are committed artefacts. |

**Most urgent operational action: commit and push the working tree.** Everything else in this report is recoverable; losing that machine is not.

---

## 13. Missing Features

**Blocking launch**
- Player XP and levelling (§7.1)
- Server-scheduled ticks (§7.3)
- Admin panel: player lookup, save repair, ban, live config, manual tick
- Password reset and email verification
- Integration and E2E test coverage
- Error monitoring and product analytics

**Expected by players**
- ~~Offline progression~~ **DONE** — shops trade while you are away, capped at an 8-hour grace window, with a "while you were away" report on return
- ~~Auto-restock / standing orders / a "manager" that runs a business for you~~ **DONE** — per-shop standing orders plus a bulk restock action
- ~~Tutorial beyond the first screen; a guided first week~~ **DONE** — an eight-step guided week on the Dashboard, ticked off by the save
- ~~Bangla UI mode~~ **DONE (infrastructure); partially applied**
- Save export / account deletion (a GDPR-style requirement if you ever serve EU users)
- Sound and haptics
- ~~PWA install + push notifications ("your Gulshan shop is out of stock")~~ **DONE** — that notification is one of the five that exist

**Depth the simulation is ready for but doesn't have**
- Supplier relationships, bulk discounts, credit terms
- Employee training, morale, attrition, promotion
- ~~Competitor price wars — AI rivals currently ignore the player entirely~~ **DONE** — rivals undercut the player's prices, open in markets the player is profiting in, and poach the player's staff; and competing now actually moves customers
- Seasonal calendar tied to the real Bangladeshi year (Ramadan, Eid, Pohela Boishakh, Victory Day) — the season *names* now follow it, the event calendar does not
- Franchising, mergers, acquiring an AI rival
- Business insurance against flood/fire events
- Quests, contracts, daily objectives
- Guilds/alliances, friend leaderboards, direct competition

---

## 14. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Working tree lost before commit | Medium | **Critical** | Commit and push today |
| R2 | ~~Levelling bug ships; players hit a hard wall at one business~~ | — | — | **Closed** — progression system implemented |
| R3 | ~~Double-counted profit corrupts the leaderboard~~ | — | — | **Closed for new saves.** Existing inflated net worths still need a one-off backfill |
| R4 | ~~Client-driven tick abused to fast-forward the shared world~~ | — | — | **Closed** — server-owned clock; the endpoint is service-authenticated |
| R5 | ~~Balance imbalance makes 2 of 5 business types dead content~~ | — | — | **Closed** — all five solved into a 25–45 day band, guarded by tests |
| R6 | ~~CSRF against money-moving endpoints~~ | — | — | **Closed** — origin check in middleware |
| R7 | No migration history — a schema change corrupts production data | Medium | High | Adopt `prisma migrate` now |
| R8 | Tick exceeds request timeout as the world grows | High | High | Background worker + batching |
| R9 | No monitoring — a production failure is discovered by players | High | Medium | Sentry + uptime check before launch |
| R10 | No monetisation path validated | **Certain** | High | Instrument retention first, then pick a Tier-1 model |
| R11 | Untested auth/API surface regresses silently | Medium | High | Integration tests on auth + money routes |
| R12 | No admin tooling — every support request requires a developer | High | Medium | Minimal admin panel |
| R13 | ~~Restocking tedium drives early churn~~ | — | — | **Closed** — per-shop standing restock orders plus a bulk restock action |
| R14 | Low IAP propensity in the target market undercuts revenue | Medium | High | Prioritise ads + brand sponsorship over IAP |

---

## 15. Recommendations

### Phase A — Unblock (1–2 weeks)
1. **Commit and push everything.** Then adopt `prisma migrate` and squash the current schema into an initial migration. *(Still outstanding — and now the most urgent item, since the fixes below also live only in the working tree.)*
2. ~~**Implement player XP and levelling.**~~ **DONE** — `src/lib/game/progression/`, 26 tests.
3. ~~**Fix the double-counted profit.**~~ **DONE** — the till is swept each tick; 8 tests. A backfill for already-inflated saves is still owed.
4. ~~**Charge for starting inventory.**~~ **DONE** — priced into `calculateExpansionCost`; 9 tests.
5. ~~**Return `business.cash` on sale.**~~ **DONE** — returned and floored at zero.
6. ~~**Validate `location`** with a Zod enum.~~ **DONE** — plus a city cross-check, which closed a real exploit; 7 tests.
7. Set up **GitHub Actions**: type-check, lint, test on every push. *(Still outstanding.)*

### Phase B — Make it a real service (2–4 weeks)
8. ~~**Move the tick to a scheduled server job.**~~ **DONE** — in-process clock plus a `CRON_SECRET` service endpoint; 28 tests.
9. ~~**Add CSRF protection.**~~ **DONE** — `Sec-Fetch-Site`/`Origin` check in middleware; 19 tests.
10. **Move rate limiting to a shared store.**
11. **Integration tests** for auth, tick, and every money-moving route; **E2E** for sign-up → first business → first tick.
12. **Sentry + uptime monitoring + structured logging.**
13. **Product analytics** on the onboarding funnel and retention.
14. **Minimal admin panel** behind a role flag.
15. **Password reset and email verification.**

### Phase C — Make it a good game (4–8 weeks)
16. ~~**Rebalance all five business types** to a 25–45 day payback band using `balance-sim.ts`; align the risk/profit/difficulty labels with reality.~~ **DONE** — solved against the shipped formulas: Tea 27d, Grocery 30d, Clothing 33d, Restaurant 36d, Mobile 39d. Spread cut from ~8× to 1.4×, absolute profit now rises with investment while ROI slightly falls, and daily restock cost is bounded to a third of the investment so a shop can fund itself. Labels, `riskLevel` and `targetMargin` re-derived from the simulation; 14 guard tests in `business-balance.test.ts`.
17. ~~**Bring utilities onto the same monthly basis as rent.**~~ **DONE** — `BUSINESS_TYPES.utilities` is a monthly bill beside `rent`, divided by 30 at tick time and scaled per level, with no city multiplier (power is nationally tariffed). The tea stall's ৳22,500/month electricity is now ৳1,200. The new-business wizard showed the monthly rent labelled "Est. daily rent"; both lines are now labelled monthly, and the analytics endpoint reports the real rent/salary/utility/tax split instead of zeros.
18. ~~**Auto-restock / business manager** to remove the daily chore.~~ **DONE** — a per-shop standing order (trigger level, refill level, optional daily cap) run by the tick before the shop opens, plus a "Restock all" bulk action. Emptiest shelves first, partial lines when cash is short, weighted-average cost basis, never spends cash the owner does not have; 13 tests.
19. ~~**Offline progression** — cap at, say, 8 hours of catch-up ticks on return.~~ **DONE** — shops trade while the owner is away and shutter after an 8-hour grace window, earning nothing and paying nothing rather than bleeding rent unattended. A client heartbeat (timer plus tab-visibility) marks presence; the first beat back returns a "while you were away" report; 15 tests.
20. ~~**Consolidate navigation** from ten destinations to six.~~ **DONE** — Portfolio folded into Businesses, Competition into Market, Achievements into Ranks, News and Settings into More. Every route still resolves; the folded screens surface as tabs within their section. Six items fit one 360px row instead of two. 19 tests.
21. ~~**Fix the 13 lint errors**; split `BusinessDetail.tsx`.~~ **DONE** — `eslint .` is clean, zero errors and zero warnings. The `set-state-in-effect` and `preserve-manual-memoization` errors were fixed at the source (subscriptions, derived state, promise-callback writes), not silenced. `BusinessDetail.tsx` went from 1,729 lines to a 660-line shell plus seven tab components and a shared context. `MarketingView.tsx` is untouched and still 883 lines.
22. ~~**Extended tutorial** covering the first in-game week.~~ **DONE** — a guided eight-step first week on the Dashboard, ticked off by the save rather than by clicking through, and the welcome slides extended to cover pricing, staff, automation and rivals. One slide still told players to press a "Next Day" button that the server clock removed; that is gone. 22 tests.
23. ~~**Make AI competitors react to the player** — undercut prices, open nearby, poach staff.~~ **DONE** — and the half that was missing underneath it: shops of the same trade in a city now compete for one pool of customers, split by price and reputation (`economy/competition.ts`), so a rival's price finally costs the player something. On top of that the AI gained player-awareness inputs and all three reactions, with the Competition screen switched to report the same share the simulation uses. 44 tests (18 economy, 26 AI).

### Phase D — Make it a business (8+ weeks)
24. ~~**Seasons/worlds** — fixed-length seasons with their own leaderboards.~~ **DONE** — a season is a 90-day world with its own clock and cohort. At the end every empire is archived read-only, the account keeps prestige and badges, and everyone restarts level. `GameState.gameDay` is gone: the day belongs to a season, which is what makes sharding possible and what fixes a leaderboard that whoever started first would otherwise top forever. Prestige is deliberately status-only — it unlocks cosmetics and never an economic edge, because carrying an advantage across a reset would rebuild the exact problem seasons exist to solve. 29 tests.
25. ~~**Bangla localisation** with a real i18n framework.~~ **DONE** — typed message catalogues where English defines the key set and every other language is type-checked against it, so a missing translation fails the build. Plural selection via `Intl.PluralRules`; numbers, money and dates through `Intl`, which gives Bangla its own numerals and lakh/crore grouping (১২,৩৪,৫৬৭ rather than 1,234,567). Locale resolved on the server from a cookie, falling back to `Accept-Language`, so the first paint and `<html lang>` are both correct. Built in-repo rather than on `next-intl`: the app has no locale routing to hang it off, and `Intl` already knows everything Bangla needs. 32 tests. **Coverage is partial** — the infrastructure is complete and navigation, seasons, the shop manager and the offline report are translated; most screen bodies are still English-only and need their strings moved into the catalogue.
26. ~~**PWA + push notifications.**~~ **DONE** — manifest, generated icon set (including maskable), a service worker with an offline shell, and Web Push on VAPID via `web-push`. The worker deliberately caches only the shell and static assets, never API responses: this is a live simulation on a server clock, and a cached `/api/player` would show figures that are simply wrong. Notifications are a closed set of five things worth interrupting someone for — empty shelves, poached staff, a season ending, shops shuttered — rate-limited per kind, mutable per device, and deleted on a 404/410 from the push service. Absent VAPID keys make it unavailable rather than broken.
27. ~~**Monetisation v1**: cosmetics + a season pass.~~ **DONE** — a catalogue in code (reviewable in a pull request, unlike a database price list), entitlements, a ten-tier season pass with free and premium lanes, and idempotent orders behind a payment-provider interface with a working sandbox. Every claim is re-validated server-side inside its transaction. **One early draft of the catalogue was pay-to-win and was cut**: an "extended offline window" selling 16 unattended hours instead of 8 would have meant more simulated days per real day, which is more money and a better rank. What is left buys clicks, never outcomes. 49 tests, of which the load-bearing one asserts that no SKU can carry an economic effect.
28. ~~**Monetisation v2**: rewarded video and convenience purchases.~~ **DONE** — and the reward is deliberately *pass XP*, not currency or a free restock. The usual rewarded-video prize would break the same rule the store obeys; what a video buys here is faster progress on the cosmetic track and not one taka more. A test asserts that a full day of video cannot fill the pass's daily XP cap, so watching ads can never substitute for playing. Every payout requires the network's signed server-side callback — the browser claiming a video finished is worth something, and anything worth something that the client can assert for free is a hole.
29. ~~**Brand-sponsorship pilot** with one FMCG or telco partner.~~ **PARTLY DONE — the system, not the pilot.** Running a partner pilot is a commercial activity, not a code change. What exists is the inventory a pilot needs: branded product lines, events and billboards, weighted across sponsors and stable for a whole game day so impressions do not depend on how often a player scrolls; daily aggregates rather than a row per impression; and an authenticated partner report. **Reach is reported as the peak of daily distinct accounts, never their sum** — summing would overstate it roughly tenfold, which is the fastest way to lose a second campaign. `docs/partner-pilot.md` has the pitch, the format table, the eight-week shape and who to approach first. 23 tests.
30. ~~**Education edition** — package it per-seat for BBA programmes.~~ **PARTLY DONE — the system, not the sale.** Cohorts with join codes and enforced seat limits, four scenario presets that fix a shared starting position, instructor-set objectives drawn from nine metrics the simulation already produces, a weighted gradebook and CSV export. `docs/education-package.md` has the tiers, the curriculum fit and an honest list of what is missing before it can be sold — the sharpest gap being that scenario constraints are shown but not yet enforced in play, which makes "everyone starts from the same position" a convention rather than a rule. 32 tests.

---

## 16. Bottom Line

The engineering here is better than the game is. The formula layer is clean, testable and well-documented; the auth system is genuinely well-built; the concurrency handling shows real care. What's missing is not skill — it's *connection*: five ambitious systems were each built to completion and then not wired into a single coherent, balanced, operable loop.

All three blocking defects are now closed: the levelling system exists, the money is counted once, and the world advances on a server clock rather than whenever a browser asks. This is a playable game rather than a collection of impressive subsystems. The balance work that follows is a tuning exercise against a harness that already exists (and which, having carried the same double-count, now reports honest numbers).

Do not think about monetisation until Phase C is done. A game where two of five business types are dead content and players cap out at one shop will not retain anyone long enough to pay you.

**Priority order: ~~fix levelling~~ → ~~fix the money~~ → ~~move the tick to the server~~ → commit the code → rebalance → instrument → monetise.**
