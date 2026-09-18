# Invariants

**This is a contract, not a record.** Everything else in `agent-ctx/` documents what a phase *did*. This documents what must remain true *afterwards*, regardless of which phase is running or which agent is holding the keyboard.

## How to use it

- **Before a phase:** read this. These are the things your change is not allowed to break.
- **During a phase:** if you need to break one, that is a design decision. Argue for it in the work record and change this file in the same commit. Silently violating one is how the defects listed below shipped.
- **After a phase:** if you established a new invariant, add it here *with its test*. An invariant with no test is a wish.

Every row names the test that holds it. `npm test` is the enforcement. The `UNGUARDED` section at the bottom is the honest part: things we believe that nothing checks.

---

## E — Economy

| # | Must remain true | Why it exists | Guarded by |
|---|---|---|---|
| E1 | Every business type pays back its investment in **25–45 game days** | Clothing paid back in 18 days and Restaurant in 148 — an 8× spread that made two of five types dead content. Players solved it once and never diversified again | `business-balance.test.ts` → *"pays back within … days"* |
| E2 | A larger investment earns **more absolute profit** but a **slightly worse ROI** | Progression must be about scale, not about finding the one correct answer. If the dearest type also had the best ROI there would be no reason to run a small shop | `business-balance.test.ts` → *"the ladder"* |
| E3 | Rent, salaries **and utilities** are monthly figures, divided by 30 at tick time | Utilities were read per-day while rent was divided by 30, so a tea stall paid ৳22,500/month for electricity on a ৳50,000 business | `economy-formulas.test.ts` → three *"correctly converts monthly … to daily"* tests |
| E4 | Utilities carry **no city multiplier** | Power and gas are nationally tariffed. Only rent varies by city | `economy-formulas.test.ts` → *"utilities ignore the city multiplier"* |
| E5 | A business type's `targetMargin` must be a margin it can **actually reach** | It was set to gross-margin-like aspirations, so every well-run shop read as permanently unhealthy | `business-balance.test.ts` → *"the health target … is one it can reach"* |
| E6 | A day's restocking costs **less than a third** of the investment | Mobile turned over ৳1.1m of stock a day on a ৳1m shop. A business must be able to fund its own float | `business-balance.test.ts` → *"a day of restocking costs less than a third"* |
| E7 | A **fully stocked** shop is limited by demand, not by its shelves | When `maxStock` sits under a day's demand, revenue is set by shelf size rather than by customers — which is what let the high-ticket types run away | `business-balance.test.ts` → *"limited by demand, not by its shelves"* |
| E8 | The risk / profit / difficulty labels describe the **measured** simulation | Clothing was tagged identically to Restaurant while returning the best and worst ROI in the game | `business-balance.test.ts` → *"labels match the simulation"* |

## A — Accounting

| # | Must remain true | Why it exists | Guarded by |
|---|---|---|---|
| A1 | Daily profit is **swept** to the player, never mirrored into both rows | Profit was counted twice into net worth, inflating every save and the leaderboard with it | `net-worth-accounting.test.ts` |
| A2 | Opening stock is **charged at wholesale**, never gifted | Free starting inventory plus a 70% buy-back was an arbitrage loop that minted cash from nothing | `starting-inventory.test.ts` |
| A3 | A restock's cost basis is a **weighted average** of old and new stock | Otherwise COGS and the liquidation value of inventory both drift away from what was actually paid | `auto-restock.test.ts` → *"keeps the cost basis as a weighted average"* |
| A4 | A standing order can never spend cash the owner does not have | It runs unattended, every tick, on every shop | `auto-restock.test.ts` → *"never spends more cash than the owner has"* |

## C — Competition

| # | Must remain true | Why it exists | Guarded by |
|---|---|---|---|
| C1 | A shop with **no rivals** behaves exactly as it did before competition existed (pressure = 1.0) | Adding a mechanic must not silently re-tune every uncontested business in the game | `competition.test.ts` → *"leaves an uncontested shop exactly as it was"* |
| C2 | Market shares **sum to 1** across everyone in a market | A share model that does not close is measuring nothing | `competition.test.ts` → *"shares always add up"* |
| C3 | Competitive pressure is **bounded** — a shop can lose at most 65% of its trade and gain at most 25% | A market has to be fightable without being winner-takes-all | `competition.test.ts` → *"never takes more than the configured floor"* |
| C4 | An AI never undercuts **into a loss** | Undercutting into a loss is not competing, it is losing slowly | `ai-rivalry.test.ts` → *"refuses to undercut into a loss"* |

## M — Monetisation

> The load-bearing section. Seasons reset so that everyone starts level; selling an economic edge would rebuild the exact advantage the reset exists to remove, and would make the leaderboard — the whole retention loop — meaningless.

| # | Must remain true | Why it exists | Guarded by |
|---|---|---|---|
| M1 | **Nothing sold affects the simulation.** Not cash, not reputation, not margin, not time | One early catalogue draft sold a 16-hour offline window instead of 8. That is more simulated days per real day, which is more money and a better rank — pay-to-win however it is worded. It was cut | `commerce.test.ts` → *"nothing sold touches the simulation"* (fails if any SKU gains a field named like an economic grant) |
| M2 | Watching video can **never substitute for playing** | A rewarded video pays pass XP only, and a full day of video cannot fill the pass's daily cap | `commerce.test.ts` → *"cannot substitute for playing the game"* |
| M3 | Every reward payout requires the **ad network's signature** over the transaction id | An unverified reward callback is an endpoint that hands out rewards to anyone who can spell the URL | `commerce.test.ts` → *"rewarded-video signature"* |
| M4 | A signature **cannot be replayed** for a different user, placement or transaction | The signed message carries all three; the unique constraint on `providerRef` stops a replay of the same one | `commerce.test.ts` → *"will not let a signature be reused"* |
| M5 | Prices are **whole poisha**. No float ever touches a price | A price is a count, not a measurement. Floats accumulate rounding error and there is no reason to invite it into a ledger | `commerce.test.ts` → *"prices are whole poisha, never floats"* |
| M6 | A pass tier's reward can be claimed **once**, and the two lanes are independent | Re-validated server-side inside the transaction; the client showing a claim button proves nothing | `commerce.test.ts` → *"canClaimTier"* |

## S — Seasons

| # | Must remain true | Why it exists | Guarded by |
|---|---|---|---|
| S1 | **Nothing economic crosses a season reset.** Prestige and badges are status only | A returning player and a first-timer must start a season on identical terms, or the ladder is uncatchable again | `seasons.test.ts` + M1 |
| S2 | An account earns prestige only if it **actually turned up** (`minDaysForCredit`) | Otherwise signing in on the last day collects a participation badge | `seasons.test.ts` → *"gives nothing to an account that barely turned up"* |
| S3 | Placing is scored **against the size of the field** | Tenth of twelve is mid-table; tenth of a thousand is exceptional | `seasons.test.ts` → *"scales placing against the size of the field"* |
| S4 | Season clock helpers never divide by zero or report negative days | A zero-length season and a clock already past its end are both reachable states | `seasons.test.ts` → *"season clock helpers"* |

## O — Offline

| # | Must remain true | Why it exists | Guarded by |
|---|---|---|---|
| O1 | The offline grace window is **8 hours**, and is not for sale | Selling more unattended hours sells more simulated days per real day, which is rank. See M1 | `offline-progression.test.ts` → *"caps at eight hours by default"* |
| O2 | A shuttered shop earns nothing **and pays nothing** | It is closed, not bankrupt. A player away for a week must not return to a chain bled dry by rent | `offline-progression.test.ts` |
| O3 | Presence checks never report negative days or throw on a bad timestamp | Clock skew and unparseable dates both reach this code | `offline-progression.test.ts` → *"treats a clock skew … as present"*, *"unparseable timestamp"* |

## B — Brand sponsorship

| # | Must remain true | Why it exists | Guarded by |
|---|---|---|---|
| B1 | **Reach is never summed** — across days or across placements | The same player on ten days is one person. Summing overstates reach roughly tenfold, which is the fastest way to lose a second campaign | `sponsorship.test.ts` → *"does not overstate reach by summing days"* / *"… within a day"* |
| B2 | A placement is **stable for a whole game day** | A shelf that changed brand on every render would make a partner's impression count depend on how often a player scrolled | `sponsorship.test.ts` → *"is deterministic for a seed"* |
| B3 | A sponsored line performs **identically** to an unsponsored one | If a branded product sold better *because* it was branded, the report would measure our thumb on the scale | Covered by M1 in principle — see UNGUARDED U4 |

## P — Product surface

| # | Must remain true | Why it exists | Guarded by |
|---|---|---|---|
| P1 | Every route in the navigation **resolves**, and lives in exactly one section | Consolidating ten destinations to six must not orphan a screen | `navigation-structure.test.ts` |
| P2 | Every English message key is **translated in every locale**, with matching placeholders | A missing translation must fail the build, not render a key at a player | `i18n.test.ts` → *"translates every English key"*, *"keeps the same placeholders"* |
| P3 | Numbers, money and dates render in the **player's own numerals** | Bangla gets Bengali digits and lakh/crore grouping via `Intl` | `i18n.test.ts` → *"groups large numbers South Asian style"* |
| P4 | A mutating API request is refused without a valid origin | 39 routes mutate state. Checked once in the proxy rather than per handler, because per handler would eventually miss one | `csrf.test.ts` |

## G — Grading (education)

| # | Must remain true | Why it exists | Guarded by |
|---|---|---|---|
| G1 | A **broken measurement scores zero**, never full marks | A NaN or Infinity means the value could not be read, not that the student achieved it | `education.test.ts` → *"scores a broken measurement as zero"* |
| G2 | Exceeding a target is **met, not extra credit** | One runaway metric must not paper over every other objective | `education.test.ts` → *"caps at the target"* |
| G3 | Seat limits are enforced **at the join point, inside the transaction** | Two students taking the last seat simultaneously must not both get it | `education.test.ts` → *"seat licensing"* |

## AI — Competitors

| # | Must remain true | Why it exists | Guarded by |
|---|---|---|---|
| AI1 | No competitor produces a **non-finite** net worth | A NaN propagating makes every other check meaningless while still looking like a number | `ai-simulation.test.ts` → *"produces finite numbers"* |
| AI2 | No competitor is **stuck holding** — every one acts at least once | An inert AI leaves every other figure looking perfectly reasonable | `ai-simulation.test.ts` → *"leaves no competitor stuck holding"* |
| AI3 | The **field does not collapse** — at most half go bankrupt | One bankruptcy in a deliberately pessimistic model is noise. Half the market going under is not — no omitted positive factor rescues that | `ai-simulation.test.ts` → *"does not let the whole field collapse"* |
| AI4 | Bankruptcies and net-worth divergence **never get worse** than today's measured baseline | A ratchet. See the note below | `ai-simulation.test.ts` → *"balance — ratcheted against today"* |

**On AI4.** The simulation currently produces **3 bankruptcies out of 8** (two AGGRESSIVE, one EXPANSIONIST) in 12 of 12 runs, and a net-worth coefficient of variation of 1.12–1.35. That is pinned, not endorsed. `BALANCE-RISKS.md` records that this harness omits events, market variation, employee bonuses and human competition — all positive factors — so it reports a harsher economy than the real engine. The figures are therefore ratcheted rather than asserted as correct: they may improve, and must not regress. **Tightening them is a balance change that has to be validated against the real engine first.** If they improve, lower `BASELINE` in the test to match, or the guard quietly loosens.

---

## UNGUARDED

Things we believe with nothing checking them. This list is the risk register for the next phase — **every defect in this repository's history started here.**

| # | Believed | Nothing checks it because | What would guard it |
|---|---|---|---|
| U1 | **No player-facing copy references removed UI** | The journey test drives HTTP, not a browser, so rendered copy is still unchecked. The API half of it is now guarded | A rendering test, or a lint rule banning known-dead strings. A tutorial slide told players to press a "Next Day" button for weeks after the server clock removed it |
| U2 | **The composite demand chain is bounded.** `game-engine.ts` multiplies **seven** modifiers onto `basePotentialCustomers` | **Now known to be violated — see below.** Each phase added one and verified its own in isolation; nobody ever owned the product | Partly ratcheted by `journey.e2e.ts` → *"serves a fraction of its market that has not got worse"*. A real fix needs the chain re-derived |
| U3 | **The Competition screen reports the same split the simulation uses** | `calculateMarketShare` was switched to the shared `calculateShopAttractiveness`, but no test asserts the two stay in step | A test that computes a market's shares both ways and asserts they agree |
| U4 | **A sponsored product performs identically to an unsponsored one** | The sponsorship ledger only observes; nothing asserts it does not influence | A test that runs a tick with and without an active sponsor and asserts identical sales |
| U5 | **Education scenario constraints are enforced in play** | They are declared and displayed; the game does not stop a student opening something outside the brief, which makes the shared starting position a convention rather than a rule | Enforcement in the create-business route, plus a test |
| U6 | ~~**API payloads are actually populated**~~ **GUARDED** | — | `journey.e2e.ts` → *"reports what the shop actually spends, not zeros"* |
| U7 | **Migrations are safe** | There is no `prisma/migrations/` at all, and `db:push` runs with `--accept-data-loss` | Adopt `prisma migrate`, squash to an initial migration |

### U2, in numbers

The end-to-end journey measured this directly, and it is the most consequential
open item in this document.

A **fully stocked** tea stall holding **47% of a 112-customer Dhaka market
serves about 9 customers a day** — roughly 8% of the market, a ~12× suppression.
It therefore trades at a loss (gross ~৳115 against ~৳190 of rent and power) no
matter how well it is stocked, which is why a new shop cannot earn
profitable-day XP.

Competition is not the cause: two evenly matched shops cost 22%, so it accounts
for at most 1.3× of the 12×. The rest is `calculateSegmentDemands`, which
returns `baseShare × price × quality × service × reputation`. For a shop with no
staff the service and quality factors are each well under 1 and compound — and
they are applied on top of a base that has *already* counted reputation and
employees. The engine has a comment acknowledging exactly this class of problem
for price and reputation, and dampens those two; quality and service were never
given the same treatment.

Consequences worth knowing before touching it:

- `balance-sim.ts` models none of this, so the 25–45 day payback band in E1 is
  measured on a chain the real engine does not use. The two disagree, and the
  simulation is the optimistic one.
- Fixing it will move every business's real earnings sharply upward, so E1 must
  be re-solved against the **engine**, not the simulation, in the same change.

---

## Changing this file

Adding an invariant: write the row, write the test, same commit.

Removing one: say why in the work record. "It was inconvenient" is a reason — it just has to be written down, because the next person needs to know the guard was removed deliberately rather than lost.
