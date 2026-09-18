# Brand sponsorship: pilot proposal

**Written for:** a brand or agency partner evaluating an in-game sponsorship, and the person at Bangladesh Business Tycoon who has to pitch it.

---

## What this is

Bangladesh Business Tycoon is a business simulation set in Bangladesh: real cities, real trades, prices in taka. Players run tea stalls, groceries, clothing shops, restaurants and electronics shops across Dhaka, Chattogram, Sylhet, Rajshahi and Khulna.

The sponsorship format is **a branded product line on a player's own shelves** — not an interstitial, not a rewarded video, not a banner. A player who runs a grocery stocks your product, prices it, and watches it sell or not sell. The brand is part of the thing they are already doing.

We build it this way for a commercial reason, not an aesthetic one. The game's entire positioning is authenticity, and an interstitial would spend that credibility to earn a CPM. The credibility is the inventory.

## Formats available

| Format | What the player sees | Where it fits |
|---|---|---|
| **Product** | A branded line on the shelf of every eligible shop — "Pran Cold Drinks" instead of "Cold Drinks" | FMCG, beverages, snacks, personal care |
| **Event** | A branded in-game event that moves demand for a few days | Seasonal campaigns, product launches, sponsorships of real events |
| **Billboard** | A branded card on the dashboard | Telcos, banks, anything without a shelf-level product |

Several sponsors can run at once; inventory is split by weight, and a given slot shows one brand consistently for a whole game day rather than rotating on every screen refresh.

## What we measure, and what the words mean

This matters more than the format, so it is spelled out precisely. The definitions are in the code and in the API response, not only in this document.

- **Impression** — a shop stocked and displayed the branded line on that game day. Observed on the server as part of the simulation. It does not depend on a tracking pixel, so it is not affected by ad blockers, and it cannot be inflated by a player scrolling.
- **Engagement** — units of the branded line actually sold that day. A purchase, not a hover.
- **Reach** — the peak number of distinct accounts reached on any single day.

**Reach is deliberately not the sum of daily figures.** The same player on ten days is one person; summing would overstate reach roughly tenfold. Many ad reports do exactly that. We would rather show a smaller honest number and keep the second campaign.

A game day is one real minute at the current clock, so a campaign accumulates a lot of days quickly. Read the day counts as simulation days, not calendar days — the report states both.

## Reporting

A live endpoint, authenticated with a token issued to the partner:

```
GET /api/sponsors/<slug>/report?from=<gameDay>&to=<gameDay>
Authorization: Bearer <token>
```

Returns totals, a day-by-day series, a breakdown per placement, and the methodology above inline — so whoever reads the numbers reads the definitions with them.

## Suggested pilot shape

**Eight weeks, one brand, one product placement.**

| Week | What happens |
|---|---|
| 0 | Placement configured, creative agreed (a name and a brand colour — no artwork production needed) |
| 1 | Live. Baseline week. |
| 2–6 | Campaign runs. Weekly report. |
| 7 | Optional: a branded event laid over the product placement, to compare formats |
| 8 | Wrap-up report and a decision on renewal |

**What we need from the partner:** a brand name, a hex colour, optionally a logo, and which product category to attach to.

**What the partner gets:** weekly reports, a final report, and the raw daily series.

## Who to approach first

Ordered by fit with the product, not by budget size:

1. **FMCG beverage or snack brands** — the best fit by a distance. They already have a shelf presence in exactly the shops the game simulates, and the product placement format needs no adaptation at all.
2. **Telcos** — large budgets and an existing games-marketing habit, but no shelf-level product in this game, so they land in the billboard format, which is the weakest of the three.
3. **Banks and MFS providers** — a strong thematic fit with the loan mechanics, and a natural second phase: a branded lending product is a genuinely interesting placement rather than a logo.

Start with one. A pilot with two brands makes the results harder to read and doubles the setup work for the same evidence.

## What we will not do

Worth saying in the pitch, because it is what makes the inventory worth buying:

- No pay-to-win. A sponsored product performs exactly like the unsponsored one. If a branded line sold better *because* it was branded, the numbers would measure our thumb on the scale rather than the brand's pull.
- No selling player data. Reports are aggregates.
- No interstitials, and no rewarded video for a brand's own creative.

## Open items before a first pilot

- No self-serve console yet: placements are configured directly against the database. Fine for one pilot, not for five.
- Billboard impressions are not yet wired to the dashboard — only the product format is counted end to end today.
- Pricing is not set. The honest way to price the first one is on reach after a two-week baseline, rather than guessing a CPM in advance.
