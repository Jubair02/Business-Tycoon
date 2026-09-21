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
| E1 | Every business type pays back its investment in **25–45 game days**, measured calendar-neutral (see CAL5) | Clothing paid back in 18 days and Restaurant in 148 — an 8× spread that made two of five types dead content. Players solved it once and never diversified again | `business-balance.test.ts` → *"pays back within … days"* |
| E2 | A larger investment earns **more absolute profit** but a **slightly worse ROI** | Progression must be about scale, not about finding the one correct answer. If the dearest type also had the best ROI there would be no reason to run a small shop | `business-balance.test.ts` → *"the ladder"* |
| E3 | Rent, salaries **and utilities** are monthly figures, divided by 30 at tick time | Utilities were read per-day while rent was divided by 30, so a tea stall paid ৳22,500/month for electricity on a ৳50,000 business | `economy-formulas.test.ts` → three *"correctly converts monthly … to daily"* tests |
| E4 | Utilities carry **no city multiplier** | Power and gas are nationally tariffed. Only rent varies by city | `economy-formulas.test.ts` → *"utilities ignore the city multiplier"* |
| E5 | A business type's `targetMargin` must be a margin it can **actually reach** | It was set to gross-margin-like aspirations, so every well-run shop read as permanently unhealthy | `business-balance.test.ts` → *"the health target … is one it can reach"* |
| E6 | A day's restocking costs **less than a third** of the investment | Mobile turned over ৳1.1m of stock a day on a ৳1m shop. A business must be able to fund its own float | `business-balance.test.ts` → *"a day of restocking costs less than a third"* |
| E7 | A **fully stocked** shop is limited by demand, not by its shelves | When `maxStock` sits under a day's demand, revenue is set by shelf size rather than by customers — which is what let the high-ticket types run away | `business-balance.test.ts` → *"limited by demand, not by its shelves"* |
| E8 | The risk / profit / difficulty labels describe the **measured** simulation | Clothing was tagged identically to Restaurant while returning the best and worst ROI in the game | `business-balance.test.ts` → *"labels match the simulation"* |
| E9 | A **fully stocked shop serves real customers and trades at a profit** | The core loop. A tea stall served nine customers a day and lost money however well it was run, so no new player could ever reach a profitable day — see the note on U2 below. Ratcheted on customers and profit rather than on market share, which tracks how many rivals the world seeded (205-840 across runs) and not whether this shop works | `journey.e2e.ts` → *"serves a real share of its market, and trades at a profit"* |
| E10 | The **segment-demand term is neutral** for an ordinary shop | Summing raw segment scores gives 1.0 only when every factor is perfect and ~0.10 for a new shop — a penalty wearing a modifier's name, multiplied onto a base that already counted the same employees and reputation | `cx-formulas.test.ts` → *"is neutral for an ordinary shop"* |
| E11 | That term stays **inside its bounds**, whatever the inputs | Employees and reputation are counted upstream too, so an unbounded normalisation would double-count upward instead of downward | `cx-formulas.test.ts` → *"stays inside its bounds for every input"* |

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

| C4 | **No shop serves more customers than its market has** | The Competition screen reported `baseCustomers x cityMultiplier` — one shop's base, before every modifier the tick applies — as the size of the whole market. Once shops traded properly a single tea stall served 130 customers out of a "112-customer market", contradicting the simulation in front of the player | `journey.e2e.ts` → *"serves a real share of its market, and trades at a profit"* |

## K — The clock

Five numbers in five files decide what playing this game feels like: the tick
interval, the season length, the offline grace, the pass track and the payback
band. Each was set sensibly alone. Their product was a season that finished in
**ninety minutes** — the same failure as U2, one layer up.

| # | Must remain true | Why it exists | Guarded by |
|---|---|---|---|
| K1 | A season runs over **days, not minutes** | At a game day a minute a season ended in 90 minutes, prestige capped inside a day, the ladder reset before lunch, and D1/D7/D30 measured nothing | `season-coherence.test.ts` → *"runs a season over days, not minutes"* |
| K2 | The offline grace is worth a **fixed number of game days** | It was eight real hours, but the harm it guards against is unattended *game* days — so at the old clock it was letting 480 of them pass, five whole seasons | `season-coherence.test.ts` → *"is worth a fixed number of game days, whatever the clock speed"* |
| K3 | The default tick sits **inside its own bounds** | The ceiling was an hour while the default became four, which would have clamped the shipped game to a quarter of its pace in silence | `season-coherence.test.ts` → *"keeps the default inside its own bounds"* |
| K4 | A season fits **more than one payback cycle** | E1 solves every type to 25-45 game days. A season holding one of those gives a player a single shop, earned back as the books close | `season-coherence.test.ts` → *"fits several payback cycles"* |
| K5 | The pass is **reachable by playing and not by waiting** | A track finished in the first week stops being a reason to return; one a single passive shop completes is asking nothing | `season-coherence.test.ts` → *"is reachable by a player who actually plays"* and *"is not handed to someone running a single shop passively"* |
| K6 | More than one season fits inside a **30-day window** | `returned_next_season` is the number the seasonal design rests on. A season longer than the retention window can never be observed being returned to | `season-coherence.test.ts` → *"fits more than one season inside a 30-day window"* |

**Settled at four hours a game day**, making a 90-day season **two weeks**. Every
other system already assumed a check-in game: push notifications, the offline
grace, the "while you were away" report, the PWA install prompt. The 60-second
clock was a development convenience that shipped. `GAME_TICK_INTERVAL_MS`
overrides it; the coherence test re-checks the relationships whatever it is set
to, so retuning the pace is safe and letting it drift apart is not.

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
| O1 | The offline grace window is a **fixed number of game days**, and is not for sale | Selling more unattended time sells more simulated days per real day, which is rank — see M1. It was written as 8 real hours, which at the old clock meant 480 game days; it is now 12 game days however fast the clock runs. See K2 | `offline-progression.test.ts` → *"is worth a fixed number of game days, whatever the clock speed"* |
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

## SU — Suppliers, credit & spoilage

Buying was one button at one price, with a standing order pressing it. There
was nothing to decide in a trading game. Four choices now sit with the player —
**who, how much, when, and on what terms** — and spoilage is what stops the
answer always being "the maximum from the importer on thirty days".

| # | Must remain true | Why it exists | Guarded by |
|---|---|---|---|
| SU1 | Cheaper suppliers are **slower and want more** | If one supplier were both cheapest and fastest there would be no decision left. Price, lead time and minimum order rise together down the ladder | `supply.test.ts` → *"trades price against time, in that order"* |
| SU2 | The emergency counter is **never offered as a choice**, and is dearer than everyone | It exists for the automatic top-up to use when nobody is minding the shop. Offering it would be offering a worse deal with no upside | `supply.test.ts` → *"keeps the emergency counter off the order screen and dearer than anyone"* |
| SU3 | Credit is charged on the **discounted goods**, not the list price | Charging the surcharge on list would quietly cancel the bulk discount for anyone buying at scale — which is everyone buying on terms | `supply.test.ts` → *"charges credit on the discounted goods, not the list price"* |
| SU4 | A bill is dated from **delivery**, not from the order | The importer's week is part of the wait. Billing from the order date would silently shorten every term it offers | `supply.test.ts` → *"dates the bill from delivery, not from the order"* |
| SU5 | Goods on terms move **no cash on the day**, and the bill is collected later | The point of credit, and the only reason a shop can stock for a rush before it has earned the rush's money | `supply.e2e.ts` → *"takes goods on terms without taking any money"* and *"collects the bill when it falls due"* |
| SU6 | An overdue bill **blocks further credit but never trading** | Credit without a consequence for missing a payment is a discount on patience. Being cut off from credit must not mean being cut off from selling | `supply.test.ts` → *"refuses credit to someone with an overdue bill"* and *"still sells for cash to someone with an overdue bill"* |
| SU7 | Supplier debt **counts against net worth** | Otherwise a player could inflate their standing by taking everything on thirty days and never settling | `supply.e2e.ts` → *"counts the bill against net worth"* |
| SU8 | **Nothing that does not perish ever spoils**, at any age | A warehouse of shirts is pure upside, which is exactly why clothing is the Eid trade. One stray unit of spoilage on a phone case would make storage a trap instead of a tool | `supply.test.ts` → *"leaves clothing and phones alone entirely"* and *"throws nothing away from a shelf that cannot perish"* |
| SU9 | Fresh stock **does** spoil, beside packaged stock that does not | The counterweight to every other incentive in the chain. Proved in one shop holding both | `supply.e2e.ts` → *"rots the fresh stock and leaves the packaged stock alone"* |
| SU10 | The spoilage shown on the order screen is the spoilage the tick applies | Both run through `spoilOneDay`. A duplicated curve had already drifted once, projecting two units of fish surviving forever | `supply.test.ts` → *"agrees with what the tick actually does"* |
| SU11 | Stock arriving **lowers a shelf's average age** | Which is what makes regular restocking the defence against spoilage rather than an unrelated chore | `supply.test.ts` → *"means a shop topped up daily never ages"* |

**On the automatic top-up.** It used to be a standing restock order that bought
on the player's behalf at their chosen threshold, to their chosen target, at
market price — and buying is the most interesting decision in a trading game.
It is now a safety net: below `EMERGENCY_RESTOCK.threshold` the shop buys from
the counter at a 25% premium and only to `EMERGENCY_RESTOCK.target`, enough to
keep the doors open and not enough to trade well on. A game day is four real
hours and shelves empty in about one, so removing it entirely would have made
the game punishing for anyone not watching it; leaving it as it was would have
meant the interesting decision stayed automated. A player who never opens the
supplier screen will survive and will quietly earn much less than one who does.

## ST — Storage & pre-buying

The calendar promised a rush — clothing x2.8 for the ten days before Eid — that
a player had no way to prepare for: shelf space is a constant per business type
and scales with nothing. Godowns raise what a shop may **hold**; they must never
raise what it appears able to **sell**.

| # | Must remain true | Why it exists | Guarded by |
|---|---|---|---|
| ST1 | Rented storage **never changes selling capacity** | Selling capacity is the denominator of the stock-availability layer. Raising it would *cut* demand, and "fixing" that in the other direction would let a player buy customers by renting a shed | `storage.test.ts` → *"leaves selling capacity untouched by any rental"* and *"cannot raise a shop’s customers by renting space"* |
| ST2 | Stock beyond a product's shelf **does not count towards demand** | Otherwise a shop could hold one product to the ceiling, read as fully stocked, and sell nothing because every other shelf was bare. Within shelf limits this is exactly the old sum, so ordinary play is unchanged | `storage.test.ts` → *"does not let godown stock inflate the stock-availability signal"* |
| ST3 | Space for a pending order is **reserved when it is placed** | Three orders that each fit must not all be placeable when together they do not. The money has already gone, so the room genuinely is spoken for | `storage.test.ts` → *"reserves space for stock already ordered"* |
| ST4 | A pre-order is **paid for at placement**, never at delivery | A delivery months later cannot then fail for want of cash, which would be the worst possible moment to discover it | `storage.e2e.ts` → *"places a bulk order, taking the money and reserving the space"* |
| ST5 | A lapsed rental **never destroys stock** | Confiscating goods a player paid for because a term ended is a punishment, not a mechanic. The shop reads as over capacity and may buy nothing more until it is back inside | `storage.test.ts` → *"reports a shop left over capacity by a lapsed rental"* |
| ST6 | A delivery that will not fit is **part-delivered and part-refunded**, oldest order first | A godown can lapse between ordering and delivery. The earliest commitment is honoured first, and nothing is silently lost | `storage.test.ts` → *"honours the earliest order first when room is short"* and *"refunds exactly what could not be housed"* |
| ST7 | **No purchase may exceed storage**, by any route | The manual buy route never checked capacity at all — any quantity could be bought into any shop — so renting space would have meant nothing | `storage.e2e.ts` → *"refuses a manual purchase that would overflow the shop"* |
| ST8 | The bulk discount **survives cheap goods** | Rounding the discount into each unit made `8 x 0.94` round back to 8, deleting it for the tea stall — the cheapest trade, and the one that most needs a reason to commit early | `storage.test.ts` → *"is not rounded away on a ৳8 product"* |
| ST9 | Stock ordered for a day is **on the shelves that day** | Deliveries run at the top of the tick, before trading, or goods bought for the morning of Eid would arrive the morning after | `storage.e2e.ts` → *"delivers on the day, and the stock is on the shelves"* |

**On ST1, and why it is first.** The obvious implementation of this feature —
add the godown bonus to `maxStockCapacity` — is actively backwards. That figure
is the denominator of the stock-availability layer in
`calculatePotentialCustomers`, so a shop with the same stock and a bigger number
reads as *emptier* and loses customers. A player who rented storage and watched
trade fall would be right to be annoyed. Capacity is therefore two numbers:
`selling` (shelves, fixed, what the demand model reads) and `storage` (shelves
plus rentals, what caps holdings). Nothing but the ceiling check reads the
second.

## AN — Analytics

| # | Must remain true | Why it exists | Guarded by |
|---|---|---|---|
| AN1 | **No personal data is ever recorded.** No email, name, password, token, IP, phone or card, in any prop | This is played largely by students in one country, and the cost of getting it wrong is not recoverable. A deny-list on the prop bag means a careless call site cannot leak a field by accident | `analytics.test.ts` → *"strips anything that could be personal"* |
| AN2 | A browser may only report **what a browser can observe** | A client claiming `purchase_completed` or `first_profit` is worth exactly nothing. Everything that implies money or game state comes from the server | `analytics.test.ts` → *"lets the browser report only what the browser can observe"* |
| AN3 | An **immature cohort is never counted** as zero retention | The classic bug. A cohort that signed up yesterday has not had a day 7; counting it as 0% drags D7 towards zero exactly when sign-ups are growing, so healthy growth reads as collapse | `analytics.test.ts` → *"refuses to measure a cohort that has not had the chance to come back"* |
| AN4 | Days are bucketed in **Asia/Dhaka**, not UTC | The audience is entirely in Bangladesh. In UTC an evening session lands on the previous day, and every daily figure is wrong by six hours of traffic | `analytics.test.ts` → *"buckets by Dhaka time, not UTC"* |
| AN5 | A funnel step **never gains users** relative to the one before it | An event recorded for someone who skipped a step would otherwise read as negative drop-off, and the funnel stops meaning anything | `analytics.test.ts` → *"never reports a step gaining users"* |
| AN6 | The **anonymous half of the funnel connects** to the account it became | Without stitching, the pre-signup steps report that nobody who visited ever signed up — the first two steps of onboarding would be unmeasurable | `analytics.test.ts` → *"makes the pre-signup funnel connect"* |
| AN7 | An anonymous id supplied by a browser is **validated before use** | An attacker-chosen id could be used to write into another browser's row, and an unbounded one as free storage | `analytics.test.ts` → *"rejects anything else"* |
| AN8 | The report endpoint **refuses when unconfigured**, rather than opening | A missing environment variable must never be the thing that publishes the numbers | `analytics.test.ts` → *"refuses when no token is configured"* |
| AN9 | Recording an event **cannot fail a player's request** | Analytics is never worth losing a purchase over. Every write is swallowed, logged, and fired with `void` | `analytics.test.ts` → *"never throws"* |

## CAL — Calendar

The Bangladeshi year, and what it does to trade. Two things here are easy to get
wrong in ways nobody notices for months: being wrong about **Bangladesh
specifically**, and being *confidently* wrong about a date that is decided by a
moon sighting rather than by arithmetic.

| # | Must remain true | Why it exists | Guarded by |
|---|---|---|---|
| CAL1 | **Pohela Boishakh is 14 April**, every year | Bangladesh revised the Bengali calendar in 2019 and West Bengal did not. Under the old astronomical reckoning the date moved between the 14th and 15th; a library built for the Indian calendar gets this wrong for Bangladesh about half the time | `calendar.test.ts` → *"pins Pohela Boishakh to 14 April, every year"* |
| CAL2 | The revision's **four anchors** hold: 14 Apr = 1 Boishakh, 16 Dec = 1 Poush, 21 Feb = 8 Falgun, 26 Mar = 12 Choitro | These four *are* the 2019 reform. The month lengths were derived from them rather than recalled, and this is the test that says so | `calendar.test.ts` → *"holds all four anchors the revision exists to guarantee"* |
| CAL3 | **No religious date is shown without its certainty.** An estimate carries a window; a settled date does not | In Bangladesh Eid is announced by the Jatiya Chand Dekha Committee the evening before. A calendar that prints an estimated Eid in the same typeface as Victory Day is lying by omission about the one date that matters most | `calendar.test.ts` → *"states how sure it is about every date"* |
| CAL4 | Seasonal demand has an **annual mean of exactly 1.0**, for every trade | This is the eighth multiplier on a demand chain U2 already records as over-suppressed. It is only safe to add because it cannot change a year's total custom at all — it moves custom around the year. Eid is a real spike because Borsha is a real trough | `calendar.test.ts` → *"averages to exactly 1.0 across a year, for every trade"* |
| CAL5 | No 30-day window's mean multiplier leaves **0.70–1.70** | A ratchet. The calendar makes *when you open* matter, which is realistic — but unbounded it would turn E1's 25–45 day band into 10–90. See the note below | `calendar.test.ts` → *"bounds how far a payback window can be moved"* |
| CAL6 | A date that cannot be computed is **omitted, never guessed** | Durga Puja needs tithi calculations this codebase does not implement. An absent date is a gap a player reports; a plausible wrong one misinforms them quietly | `calendar.test.ts` → *"shows nothing rather than a guess for an announced-only date"* |
| CAL7 | A confirmed date sits **within two days** of the arithmetic | A sighting moves a date by one day, occasionally two. Anything further is far more likely to be a typo in `confirmed.ts` than a real announcement | `calendar.test.ts` → *"agrees with the arithmetic to within a couple of days"* |
| CAL8 | Any year resolves to a **full calendar**, with no lookup table | The requirement that forces rules over data. A hard-coded table is wrong by year two, because the Islamic dates drift eleven days a year | `calendar.test.ts` → *"produces a full year for any year, without a lookup table"* |
| CAL9 | The multiplier is **never non-finite** | A NaN here propagates into customers, revenue and net worth while still looking like a number | `calendar.test.ts` → *"never returns a non-finite multiplier"* |

**On CAL5, and what it does to E1.** E1 pins every business type to a 25–45 day
payback, measured by `balance-sim.ts` — which does **not** model the calendar,
and should not: it measures whether the five *types* are balanced against each
other, holding timing constant. With the calendar running, payback also depends
on *when* a shop opens. Measured over 2025–2028, the mean multiplier across a
30-day window ranges from **0.733** (clothing, opening the day after Eid-ul-Adha)
to **1.662** (clothing, opening into the Eid build-up). So a clothing shop's real
payback can be roughly 0.6× to 1.4× its calendar-neutral figure.

That is deliberate — timing a shop to the retail year is a real skill and the
main thing the calendar adds as a *mechanic* rather than as decoration — but it
means E1 should be read as "calendar-neutral payback", not "payback". The bound
is pinned rather than endorsed, in the style of AI4: it may narrow, and must not
widen without someone deciding that on purpose.

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
| U1 | ~~**No player-facing copy references removed UI**~~ **PARTLY FIXED** | Seven empty states still read "Advance days to generate data" — an instruction to use a control the server clock removed. Fixed, and now scanned for. The scanner reads source, not rendered pages, so it catches this class and not every case | `dead-copy.test.ts` → *"never tells the player to advance the day themselves"* |
| U2 | ~~**The composite demand chain is bounded**~~ **FIXED** | The largest term was `segmentDemandModifier`, a penalty multiplied onto a base that already counted the same inputs. Normalised — see the note below | `cx-formulas.test.ts` → *"is neutral for an ordinary shop"*; `journey.e2e.ts` → *"serves a real share of its market, and trades at a profit"* |
| U3 | ~~**The Competition screen reports the same split the simulation uses**~~ **PARTLY FIXED** | `totalDemand` was one shop's base presented as the whole market; it is now the customers the market actually served, so no shop can exceed it. The *shares* are still attractiveness fractions that no test cross-checks against the tick | `journey.e2e.ts` → *"serves a real share of its market, and trades at a profit"* (C4). A shares cross-check is still wanted |
| U4 | **A sponsored product performs identically to an unsponsored one** | The sponsorship ledger only observes; nothing asserts it does not influence | A test that runs a tick with and without an active sponsor and asserts identical sales |
| U5 | **Education scenario constraints are enforced in play** | They are declared and displayed; the game does not stop a student opening something outside the brief, which makes the shared starting position a convention rather than a rule | Enforcement in the create-business route, plus a test |
| U6 | ~~**API payloads are actually populated**~~ **GUARDED** | — | `journey.e2e.ts` → *"reports what the shop actually spends, not zeros"* |
| U7 | **Migrations are safe** | There is no `prisma/migrations/` at all, and `db:push` runs with `--accept-data-loss` | Adopt `prisma migrate`, squash to an initial migration |

### U2, in numbers — before and after

This was the most consequential item in this document, and it is now closed.

**Before.** A fully stocked tea stall holding 47% of a 112-customer Dhaka market
served about **9 customers a day** — roughly 8% of the market, a ~12x
suppression. It traded at a loss (gross ~৳115 against ~৳190 of rent and power)
however well it was stocked, so a new player could never reach a profitable day
and profitable-day XP never fired.

**The cause.** `segmentDemandModifier` was the sum of the raw per-segment
scores. That sum is 1.0 only when price, quality, service and reputation are all
perfect, and about **0.10** for a new shop — `calculateServiceQuality` returns a
flat 0.1 for a shop with no staff, and the segments raise it to powers up to 1.4.
It was a penalty, not a modifier, and it was multiplied onto a base that had
already counted the same employees (Layer 5) and reputation (Layer 3). The call
site had spotted this for price (passed as 1.0) and reputation (dampened);
quality and service never got the same treatment.

**The fix.** `calculateSegmentDemandModifier` dampens quality and service the
same way reputation already was, normalises against a reference shop — health
50, no staff, reputation 50 — so that shop reads exactly **1.0**, and clamps to
0.65–1.5 so the upstream double-count cannot reappear in the other direction.
`calculateSegmentDemands` is untouched, so satisfaction, reviews and the CX
screen keep their meaning.

**After.** The same tea stall, on a standing restock order, serves **115–139
customers** and earns **৳1,479–2,383 a day** — a payback of roughly **21–34
days** on its ৳50,000, against the 25–45 day band E1 was solved to in
`balance-sim.ts`. **The engine and the simulation now agree**, which is what
this note previously said was required before E1 could be trusted.

Two things surfaced while fixing it, both now closed:

- Shops empty their shelves in about a day at the corrected demand, so a shop
  stocked once and left alone takes visitors it has nothing to sell. That is
  what the standing restock order is for, and the journey now turns it on.
- The Competition screen's `totalDemand` was one shop's base, so a single stall
  appeared to serve 130 of a 112-customer market. It is now measured. See C4.

---

## Changing this file

Adding an invariant: write the row, write the test, same commit.

Removing one: say why in the work record. "It was inconvenient" is a reason — it just has to be written down, because the next person needs to know the guard was removed deliberately rather than lost.
