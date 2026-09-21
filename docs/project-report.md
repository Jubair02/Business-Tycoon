# Bangladesh Business Tycoon — Project Report

**Written for:** the project owner and anyone they show this to — a prospective teammate, partner, investor or instructor. It assumes no prior knowledge of the codebase.

**As at:** 21 September 2026
**Status:** feature-complete for a first release; **not yet deployed to production**
**Scale:** 31 data models · 50 API endpoints · 14 screens · ~49,700 lines of TypeScript · 848 automated tests

> **Relationship to `PROJECT-REPORT.md`:** that file is the original audit and its fix log — valuable history, but it now reads as a changelog. This document is the current state.

---

## 1. Executive summary

Bangladesh Business Tycoon is a browser-based business simulation set in Bangladesh. A player opens a tea stall in Dhaka with ৳500,000, prices the shelves, hires staff, watches rivals undercut them, and tries to build a conglomerate across five cities before a 90-day season closes and everyone starts level again.

**What is genuinely strong.** The simulation underneath is unusually serious for a game of this size: a server-authoritative economy with price elasticity, per-product demand, customer segments, NPS, marketing attribution, and eight AI competitors that react to the player. The code is well-factored and heavily commented, and there are 848 automated tests including an end-to-end journey against a real database. The monetisation design is disciplined — a tested invariant makes it impossible to ship a SKU that affects the simulation.

**What is genuinely weak.** Three things, in order:

1. **There is no usage data yet.** Product analytics is now **built** (onboarding funnel, D1/D7/D30 cohort retention, session length, drop-off — `src/lib/analytics/`, `GET /api/analytics/report`), but it has recorded nothing: the schema is not pushed and the production database holds 20 player rows from before it existed. Error monitoring and uptime checks are still absent. Every business statement in this report — about retention, pricing, willingness to pay — is therefore still a *hypothesis*, not a finding. It is now a hypothesis that can be tested.
2. **A demand-chain defect suppresses a shop's customers by roughly 12×**, which means a fully stocked tea stall trades at a loss. This is measured, reproducible, and documented as U2 in `agent-ctx/INVARIANTS.md`. It also means the published 25–45 day payback band was measured against a simulation the live engine does not match.
3. **Nothing enforces quality automatically.** There is no CI. 848 tests exist and run only when someone types `npm test`.

**The honest position:** this is a strong product with a broken core number, no deployment pipeline, and no way to learn anything from players. Those three are the whole gap between "impressive prototype" and "business."

---

## 2. Business model

### 2.1 Positioning

A business simulation that is *specifically Bangladeshi*, not a generic tycoon game with names swapped. Real cities (Dhaka, Chattogram, Sylhet, Rajshahi, Khulna) and real localities within them (Gulshan, Old Dhaka, Agrabad, GEC Circle). Real trades — tea stall, grocery, clothing, restaurant, mobile & electronics. Prices in taka, grouped in lakh and crore. A full Bangla interface with Bengali numerals.

That authenticity is the moat. It is hard for an international studio to copy convincingly, and it is what makes the two B2B revenue lines (brand sponsorship, education) plausible at all.

### 2.2 Target market

| Segment | Why | Reachable? |
|---|---|---|
| Young urban Bangladeshis, mobile-first | The core audience for a taka-denominated business sim | Yes — PWA install, no app store needed |
| The diaspora | Nostalgia and cultural connection; higher spending power | Yes, but needs discovery |
| BBA / business students | The simulation already teaches the syllabus (§9) | Via institutions, not ads |
| FMCG & telco brands | In-world placement against an authentic audience | Via direct sales |

### 2.3 Revenue lines

| # | Line | Built? | Live? | Blocker |
|---|---|---|---|---|
| 1 | **Cosmetics** — signage, frames, city skins, titles | ✅ | ❌ | No payment provider connected |
| 2 | **Season pass** — 10-tier free + premium track, ৳299 | ✅ | ❌ | Same |
| 3 | **Rewarded video** — pays cosmetic-track XP only | ✅ | ❌ | No ad network account |
| 4 | **Brand sponsorship** — branded shelves, events, billboards + partner reporting | ✅ | ❌ | No partner signed |
| 5 | **Education** — cohorts, scenarios, gradebook, per-seat | ✅ | ❌ | No institution signed; no billing |

Everything runs behind provider interfaces with a working sandbox, so the store is fully playable today and charges nobody.

### 2.4 The rule that governs all of it

**Nothing sold affects the simulation.** Not cash, not reputation, not margin, not time. Seasons reset so everyone starts level; selling an economic edge would rebuild the exact advantage the reset exists to remove, and would make the leaderboard — the whole retention loop — meaningless.

This is enforced, not merely intended: `commerce.test.ts` fails the build if any catalogue item gains a field that looks like an economic grant. One early draft sold a "16-hour offline window" instead of 8 — more simulated days per real day, therefore more money, therefore a better rank — and was cut for exactly this reason.

### 2.5 Unit economics — unknown

No CAC, no ARPU, no conversion rate, no retention curve. Not "poor" — **absent**. This is the single most important gap in the business case and the cheapest to close.

---

## 3. Core features

**Business operations** — open a shop (5 types × 5 cities × 14 localities), buy and sell stock, set every shelf price, hire and fire across 5 staff roles, upgrade, sell the business.

**Economy** — layered customer model (city, level, reputation, stock, staff, events, volatility); per-product price elasticity; COGS tracking; monthly rent, salaries and utilities divided to a daily charge; profit tax with a revenue floor; business health scoring; ROI and payback.

**Competition** — shops of the same trade in the same city draw on one pool of customers, split by price and reputation. Eight AI competitors with five personalities that undercut the player's prices, open in markets the player is profiting in, and poach the player's staff.

**Customer experience** — satisfaction, loyalty tiers, repeat-customer rate, NPS, generated reviews across four customer segments.

**Marketing** — six channels (social, Facebook ads, local ads, influencer, billboard, TV) with budgets, reach, conversions, brand awareness and revenue attribution.

**Progression** — XP and levelling; 12 achievements; expansion gating with cooldowns and setup periods; a guided eight-step first week ticked off by the save.

**Seasons** — 90-day worlds with their own clock and cohort; empires archived read-only at the end; prestige and badges carry over as status only.

**Operations** — standing restock orders ("shop manager") and a bulk restock, so the daily chore is optional; offline progression with an 8-hour grace window and a "while you were away" report.

**Supporting** — bank and loans (5% flat, capped at `level × ৳200,000`); market prices with event effects; news feed; leaderboards; portfolio view; PWA install and push notifications; English/Bangla.

---

## 4. User roles

| Role | Authentication | Can do |
|---|---|---|
| **Guest** | Signed cookie | Play; save is claimable on sign-up |
| **Player** | Email/password (scrypt) or Google | Everything in §3 |
| **AI competitor** | None — engine-owned | Trades in the same economy, on the same rules |
| **Instructor** | Player account that created a cohort | Set scenarios and objectives, see the gradebook, export CSV |
| **Student** | Player account that joined by code | Play inside a cohort; sees objectives, not the class |
| **Sponsor** | Bearer token | Read their own campaign report |
| **Cron / service** | `CRON_SECRET` | Advance the world clock |

**Gap:** there is no administrator role, and no distinct instructor account type — any player can create a cohort and mark themselves.

---

## 5. Key workflows

**Onboarding** → welcome → sign up → tutorial slides → guided first week on the dashboard (open a shop, stock it, set prices, turn a profit, hire, automate, grow, finish week one).

**Daily loop** → the server advances a game day every real minute → shops sell, pay rent and wages, accrue reputation → the client notices the day change and shows a daily summary → the player restocks, reprices, hires, expands.

**Season loop** → 90 days → standings computed → every empire archived → prestige and badges awarded → new season opens with a fresh AI cohort → returning players get ৳500,000 and start level.

**Away and back** → shops keep trading for up to 8 hours unattended, then shutter (earning nothing, paying nothing) → on return, a "while you were away" report.

**Classroom** → instructor creates a cohort with a scenario and objectives → students join with a 6-character code → everyone plays the same starting position → instructor reads the gradebook and exports CSV.

---

## 6. System architecture

### 6.1 Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind + shadcn/ui · Prisma 6 → PostgreSQL (Neon) · Zustand · Vitest · PGlite for tests.

### 6.2 Shape

```
Browser (PWA)
   │  polls /api/game/state every 10s · heartbeat every 60s
   ▼
proxy (middleware.ts) ── CSRF origin check on every mutating /api/*
   ▼
Route handlers (50) ── Zod validation → auth → domain call
   ▼
Domain libraries (pure, testable)
   economy · ai · marketing · expansion · progression
   seasons · offline · operations · commerce · sponsorship · education · i18n
   ▼
game-engine.ts ── the tick
   ▼
Prisma → PostgreSQL
```

**The important architectural decision** is that the world clock lives on the server (`lib/game/scheduler.ts`, started from `instrumentation.ts`). It used to be driven by a browser `setInterval`, which meant any signed-in player could fast-forward the shared economy for everyone. `/api/game/tick` is now a service endpoint authenticated by a shared secret; the client only polls.

**The second** is the split between pure formula modules and the impure engine. It is why 832 unit tests are possible at all.

### 6.3 The tick

Per game day: expire events → advance the season clock → maybe generate an event → update market prices (every 3rd tick) → **simulate every trading business** → process loans → run AI decisions → maybe generate news → flush sponsorship stats → close the season if it has run its course.

Businesses whose owner has been away past the 8-hour window are skipped entirely — they earn nothing and are charged nothing.

### 6.4 Data model

31 models in four groups: **identity** (User, AuthSession, OAuthAccount, PushSubscription), **game** (Player, Business, Inventory, Employee, Product, MarketPrice, GameEvent, Loan, plus metrics and reviews), **seasons** (Season, SeasonArchive), and **commercial** (Entitlement, Purchase, SeasonPass, AdReward, Sponsor + placements + daily stats, Cohort + members + objectives).

---

## 7. Current implementation status

| Area | Status | Note |
|---|---|---|
| Core simulation | ✅ Complete | But see §8.1 |
| AI competitors | ✅ Complete | Player-aware; 3 of 8 go bankrupt in the harness |
| Seasons | ✅ Complete | Rollover never exercised at scale |
| Auth | ✅ Complete | No password reset, no email verification |
| Monetisation | ✅ Built | Sandbox only — no provider connected |
| Sponsorship | ✅ Built | No partner; billboard format not wired to the dashboard |
| Education | ✅ Built | Scenario constraints displayed but **not enforced in play** |
| PWA + push | ✅ Built | Needs VAPID keys |
| Bangla | ⚠️ Partial | Infrastructure complete; most screen bodies still English |
| Testing | ✅ Strong | 832 unit + 16 E2E; no CI |
| Deployment | ❌ None | Schema not pushed; no migrations; no CI/CD |
| Monitoring | ⚠️ Partial | Product analytics built, not yet collecting. No error monitoring, no uptime |
| Admin | ❌ None | No support tooling of any kind |

---

## 8. Strengths

1. **The economy is modelled, not faked.** Price elasticity, COGS, working capital, monthly-vs-daily cost bases, tax, reputation dynamics. It behaves like a business, which is what makes the education line credible.
2. **Test depth is far above normal** for a project this size — 848 tests, including balance guards that re-solve the economy end to end and fail if it drifts.
3. **An invariants contract** (`agent-ctx/INVARIANTS.md`): 43 invariants, each naming the test that holds it, plus an honest list of 7 that nothing checks. A test validates the document's own citations.
4. **Monetisation discipline.** The no-pay-to-win rule is machine-enforced.
5. **Code quality.** Comments explain *why*, not *what*. Pure/impure separation is consistent.
6. **Mobile-first and considered.** 44px touch targets, six-section navigation, offline shell, taka formatting with lakh/crore.
7. **Security fundamentals are right.** scrypt passwords, HMAC-signed sessions, CSRF checked centrally, Zod on every mutation, the tick service-authenticated.

---

## 9. Weaknesses and open issues

### 9.1 The demand chain — the most consequential (U2)

**Measured:** a fully stocked tea stall holding 47% of a 112-customer Dhaka market serves **about 9 customers a day** — roughly 8% of the market. It therefore trades at a loss (gross ~৳115 against ~৳190 of rent and power) no matter how well stocked it is, which is why a new shop cannot earn profitable-day XP.

**Cause:** `simulateBusinessTick` multiplies seven modifiers onto the base customer count. `calculateSegmentDemands` returns `baseShare × price × quality × service × reputation`; for a shop with no staff the service and quality factors are each well under 1 and compound — on top of a base that has *already* counted reputation and employees. Competition explains at most 1.3× of the 12×.

**Consequences:**
- New players experience a shop that loses money however well they play it.
- The 25–45 day payback band (E1) was solved against `balance-sim.ts`, which models none of this. The simulation and the engine disagree, and the simulation is the optimistic one.
- Fixing it will move real earnings sharply upward, so the balance band must be re-solved **against the engine** in the same change.

### 9.2 No automated enforcement

No CI. No `.github/` at all. 848 tests and a clean typecheck exist entirely on the honour system. This is the root cause of the project's defect history: every gate was voluntary and agent-reported.

### 9.3 No deployment path

No `prisma/migrations/` — the schema has only ever been pushed. `db:push` runs with `--accept-data-loss`. The production database is on the **old schema** (no `Season` table), so the current code cannot run against it.

### 9.4 No observability

Product analytics now exists and is wired into the routes and the tick; once the schema is pushed it starts answering the onboarding, retention, session and drop-off questions. Everything else in this row is still missing: no error monitoring, no uptime checks, no structured logging. A production failure would still be discovered by a player.

### 9.5 Scaling constraints

| Constraint | Detail |
|---|---|
| Tick is O(businesses), sequential | ~66 database operations in the engine; one extra rival query per business per day |
| Rate limiter is an in-process `Map` | Limits multiply by instance count — and it now fronts money endpoints |
| Client polling | Every client re-fetches on a 10s and 30s timer |
| Leaderboard | `take: 50` then in-memory sort — correct only while a season's cohort is small |
| No caching | No Redis, no HTTP cache headers |

Seasons make sharding *possible* (each has its own clock and cohort) but nothing shards yet.

### 9.6 Security gaps

Rate limiting is per-process; no password reset or email verification; no 2FA; no admin audit trail; `SPONSOR_REPORT_TOKEN` is a single shared bearer rather than per-partner; **4 high-severity CVEs in `sharp`** (fix is a semver-major upgrade, low risk here since `next/image` is unused).

### 9.7 Technical debt

`MarketingView.tsx` is 883 lines. `middleware.ts` uses a convention Next 16 deprecated in favour of `proxy`. Prisma 7, ESLint 10, Recharts 3 and lucide-react 1.x are all majors behind.

---

## 10. Missing features

**Blocking a real launch:** admin panel · password reset and email verification · error monitoring · CI/CD · database migrations. (Product analytics is now built.)

**Expected by players:** complete Bangla coverage · sound and haptics · save export and account deletion (GDPR-shaped if you ever serve the diaspora in the EU) · friend leaderboards.

**Blocking revenue:** a payment provider · an ad network account · a sponsorship console (placements are configured directly in the database) · institutional billing and a real instructor role.

**Depth the simulation is ready for:** supplier relationships and bulk discounts · employee training, morale and attrition · a seasonal calendar tied to the real Bangladeshi year (Ramadan, Eid, Pohela Boishakh, Victory Day) · franchising and acquiring a rival · business insurance · quests and contracts · guilds.

---

## 11. Operational readiness

| Process | State |
|---|---|
| Build | `next build` succeeds |
| Test | `npm test` (1s) · `npm run test:e2e` (13s, real Postgres via PGlite) · `npm run test:all` |
| CI/CD | **None** |
| Migrations | **None** — push only |
| Environments | One. No staging |
| Secrets | Documented in `.env.example`; production refuses to boot on a weak `SESSION_SECRET` |
| Monitoring | **None** |
| Backups | Whatever Neon provides by default |
| Runbook | **None** |
| Support tooling | **None** |

---

## 12. UI / UX

**Strengths.** Six-section navigation (down from ten), with overlapping screens folded in as tabs — nothing was deleted. Persistent shell, so polling survives navigation. Server-side route guard, so no flash of authenticated UI. A guided first week ticked off by real save state. Daily summary with deltas. Skeletons, toasts, page transitions. Light/dark. A documented design system at `design-system/business-tycoon/MASTER.md`. `eslint .` is clean — the React 19 correctness warnings were fixed at source, not suppressed.

**Weaknesses.** Bangla covers navigation and a few surfaces; most screen bodies are still English. Accessibility is unverified — no automated a11y check, no keyboard-navigation test, no contrast audit. `MarketingView.tsx` remains oversized. No empty/error-state audit. And the first-run experience is currently poor for the reason in §9.1: a new player's shop loses money.

---

## 13. Project structure

```
src/
  app/
    (game)/          14 screens behind a server-side auth guard
    api/             50 route handlers
    manifest.ts      PWA manifest
  components/game/   ~13,000 lines; BusinessDetail split into 7 tab components
  lib/
    game/            economy · ai · marketing · expansion · progression
                     seasons · offline · operations   (~10,000 lines)
    commerce/        catalogue · season pass · rewards · providers
    sponsorship/     placements · tracking
    education/       objectives · scenarios
    i18n/            config · translate · messages/{en,bn}
    auth/            password · session · google · account
    push/            notifications
  __tests__/         27 files · 832 tests
e2e/                 harness + player journey · 16 tests
agent-ctx/           phase records + INVARIANTS.md (the contract)
docs/                partner-pilot.md · education-package.md · this report
prisma/schema.prisma 31 models
```

---

## 14. Business recommendations

### 14.1 The sequencing problem

There are five revenue lines built and zero validated. The temptation is to switch them all on. That would be a mistake: until analytics has collected a few weeks of real data you would not be able to tell which one worked.

**Instrument first, then turn on exactly one.**

### 14.2 Which line to bet on

| Line | Revenue ceiling | Time to first taka | Confidence | Verdict |
|---|---|---|---|---|
| Cosmetics + pass | Low–medium | Weeks | Low — IAP propensity in-market is low | Turn on, but expect little |
| Rewarded video | Medium | Weeks | Medium — fill rates are good locally | **Best first bet for B2C** |
| Sponsorship | **High** | Months | Medium — needs one partner to price | **Best overall bet** |
| Education | Medium, recurring | Months | **Highest** — the product already does the job | **Most defensible** |

**Recommendation: run education and sponsorship in parallel as the real business, and treat B2C monetisation as a retention experiment rather than a revenue line.** Both B2B lines have a named buyer, a budget that already exists, and far lower CAC than chasing consumer installs.

### 14.3 Concrete moves

1. ~~**Add analytics before anything else.**~~ **Built.** Onboarding funnel, D1/D7/D30 cohort retention, session length and drop-off, computed in-repo so the definitions are reviewable rather than a vendor's. Remaining: push the schema, set `ANALYTICS_REPORT_TOKEN`, and let it collect. Everything below stays a guess until it has.
2. **Fix §9.1 first.** A new player's shop losing money is the single biggest threat to D1 retention, and no marketing spend survives it.
3. **One education pilot, free, one lecturer, one semester.** Ask for the gradebook back. `docs/education-package.md` has the tiers and the honest gap list.
4. **One sponsorship pilot with an FMCG beverage or snack brand** — the only format needing no adaptation. `docs/partner-pilot.md` has the eight-week shape. Price on measured reach after a two-week baseline rather than guessing a CPM.
5. **Finish Bangla.** The infrastructure is done; the remaining work is moving strings into the catalogue. It is the cheapest growth lever available and central to the positioning.
6. **Seasons are the retention engine — measure them.** Does a season reset bring players back? That is the core hypothesis of the whole design and nothing currently tests it.

### 14.4 New feature ideas, ranked by business value

| Idea | Why it earns |
|---|---|
| **Shareable season card** — an image of your final rank, empire and badges | The only viral loop in the design. Cheap; seasons already produce the data |
| **Real Bangladeshi calendar** — Ramadan, Eid, Pohela Boishakh, Victory Day | Deepens the moat; makes seasons feel situated; natural sponsorship moments |
| **Friend leaderboards / guilds** | Retention multiplier, and the leaderboard is already season-scoped |
| **Supplier relationships and credit terms** | The most-requested depth in this genre; teaches working capital, so it serves education too |
| **Instructor console + billing** | Converts the education build into revenue |
| **Sponsorship self-serve console** | Converts one pilot into a repeatable line |

---

## 15. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Demand-chain defect wrecks first-run retention | **Certain** | **Critical** | Fix §9.1; re-solve the balance band against the engine |
| R2 | No *data* yet → monetisation decisions are still guesswork | **Certain** | High | Instrumentation is built; collect a few weeks before switching any line on |
| R3 | No CI → the defect pattern repeats | High | High | GitHub Actions running both suites |
| R4 | Schema change corrupts production data | Medium | High | Adopt `prisma migrate`; drop `--accept-data-loss` |
| R5 | Production failure found by a player | High | Medium | Sentry + uptime check |
| R6 | `sharp` CVEs | Medium | Medium | Upgrade to 0.35.4 |
| R7 | No support tooling — every issue needs a developer | High | Medium | Minimal admin panel |
| R8 | Tick exceeds its budget as players grow | Medium | High | Batch businesses; bounded concurrency |
| R9 | Rate limiter ineffective on >1 instance | Medium | Medium | Move to Redis or Postgres |
| R10 | Education sold before scenario rules are enforced | Medium | Medium | Enforce constraints in the create-business route |
| R11 | Sponsorship reach overstated to a partner | Low | High | Already mitigated — reach is peak-daily, never summed |
| R12 | No password reset → permanent account loss | Medium | Medium | Ship reset + email verification |

---

## 16. Recommended roadmap

**Phase 1 — Make it deployable (1–2 weeks)**
Fix the demand chain and re-solve the balance band against the engine · adopt `prisma migrate` and squash an initial migration · GitHub Actions for typecheck, lint, unit and E2E · upgrade `sharp` · rename `middleware.ts` → `proxy.ts` · push the schema and deploy to a staging environment.

**Phase 2 — Make it observable (1–2 weeks)**
Sentry · uptime monitoring · structured logging · a minimal admin panel behind a role flag. (Product analytics on the onboarding funnel and retention is built.)

**Phase 3 — Make it safe to run (2–3 weeks)**
Password reset and email verification · shared-store rate limiting · save export and account deletion · a runbook · integration tests on every money-moving route.

**Phase 4 — Make it earn (4–8 weeks)**
Finish Bangla · complete the first-week experience against the fixed economy · one education pilot · one sponsorship pilot · turn on rewarded video · instrument everything and iterate.

**Phase 5 — Make it grow (8+ weeks)**
Shareable season cards · the Bangladeshi calendar · friend leaderboards and guilds · supplier depth · instructor console and billing · sponsorship self-serve.

---

## 17. Bottom line

The hard part is done. There is a real economic simulation here, tested to a standard most commercial projects never reach, with a monetisation design that refuses to sell advantage and a positioning that is genuinely hard to copy.

What stands between it and a business is unglamorous and almost entirely mechanical: one arithmetic defect in the demand chain, a deployment pipeline, and the instrumentation to find out whether anybody wants to play it. None of those is a research problem. All three are a few weeks of work.

The one thing that would be a mistake is to build more features first. The product is not short of features. It is short of evidence.
