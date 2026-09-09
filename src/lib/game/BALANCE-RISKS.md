# Balance Risks & Known Issues

> Last updated: Phase 3 verification & stabilization

## ⚠️ AI/Economy Balance Risks

### 1. Thin Margins at Level 1
Some level 1 businesses (especially TEA_STALL and GROCERY_STORE) may have thin
profit margins at the default reputation of 50 with no employees. A few bad days
(events, stockouts, or aggressive competition) can push them unprofitable.

**Mitigation:** The AI mandatory restock and personality-based pricing help.
Human players can improve margins via employees, upgrades, and pricing strategy.

### 2. Long-Term Simplified Simulations Overstate AI Bankruptcies
The deterministic AI simulation (`ai-simulation-test.ts`) does not include:
- Game events (which can boost demand)
- Market price variation
- Employee skill bonuses to reputation
- Human player competition effects

Without these positive factors, the simulation can produce higher AI bankruptcy
rates than the real game engine. Do not tune AI difficulty solely from sim results.

### 3. Use Full-Engine Results for Final Balance Decisions
Both `ai-simulation-test.ts` and `balance-sim.ts` are simplified approximations.
They are useful for quick sanity checks but NOT for final balance tuning.

**Always validate balance changes against the real game engine.**

### 4. Personality Dominance Risk
If one personality type consistently outperforms others by >3x in net worth
over 100 days, the `PERSONALITY_CONFIGS` weights should be adjusted.

### 5. Market Share Stability
Market share is recalculated per tick using attractiveness scores. Rapid
price changes by multiple AI players in the same tick can cause share
fluctuations. This is expected behavior but should be monitored.

## ⚠️ Phase 3 CX Balance Risks

### 6. CX Demand Modifier Feedback Loop (MONITOR)
Satisfaction → loyalty → CX demand modifier → customers → revenue → satisfaction.
This creates a positive feedback loop for good businesses and a negative one for bad.
The 0.2 smoothing factor provides ~3-day half-life damping, but sustained poor
performance can create a loyalty "death spiral" that takes 20+ days to recover from.

**Mitigation:** CX demand modifier is clamped to [0.2, 2.0], preventing
catastrophic zeroing or runaway growth. Segment modifier further dampens extremes.

### 7. Stock and Employee Double-Counting (ACCEPTED)
Stock availability affects both `calculatePotentialCustomers` Layer 4 (direct
customer reduction) AND satisfaction (via `stockAvailability` weight 0.15), which
feeds into the CX demand modifier. Similarly for employees.

**Assessment:** These are conceptually different signals — "can we serve customers"
(direct) vs "are customers happy" (satisfaction). The combined penalty at 0% stock
is ~0.1× customers, which is harsh but realistic for a fully out-of-stock business.

### 8. Loyalty Break-Even at 57% Positive Days
With dailyGain=3 and dailyLoss=4, a business needs ~57% positive days to maintain
loyalty. This means 3 out of 5 good days is needed just to break even. Below this,
loyalty trends toward 0.

**Assessment:** This mirrors real-world negativity bias. The asymmetric ratio (1.33:1)
is moderate — not the original 2:1 that would require 67% positive days.

### 9. Segment Demand Sensitivities Are Multiplicative
When all four factor dimensions (price, quality, service, reputation) are below 1.0,
the power sensitivities multiply together, creating potentially extreme demand
reduction for poor businesses. A business with all factors at 0.3 could see
segment modifier of ~0.05.

**Mitigation:** `Math.max(0.01, factor)` prevents `0^x` issues. Price is excluded
from segment demands (already handled by per-product priceDemandMultiplier and
satisfaction). Reputation is dampened to avoid quadruple-counting.

### 10. AI Does Not React to Poor CX (FUTURE IMPROVEMENT)
AI businesses receive full CX calculations and CX affects their demand, revenue,
and market share. However, the AI decision engine does not currently consider
satisfaction/loyalty scores when making pricing, inventory, or hiring decisions.
Extremely poor CX can persist indefinitely because AI does not react.

**Future improvement:** Add CX-aware AI actions (e.g., if satisfaction < 30,
consider lowering prices or hiring more staff).

### 11. NPS Requires ≥90 Satisfaction for Positive Score
At satisfaction ~85, reviews are 4★ (passive), giving NPS of 0. Positive NPS
requires satisfaction ≥90 (5★ promoters). This is by design (NPS is harsh in
real life too) but may frustrate players who see "NPS: 0" despite decent satisfaction.

## Simulation Files & Their Limitations

| File | Purpose | Limitation |
|------|---------|------------|
| `ai/ai-simulation-test.ts` | AI personality balance over 100 days | No events, no market prices, simplified sales, no human players |
| `economy/balance-sim.ts` | Per-business-type profitability | No employees, auto-restock, no events, no competition |
| `__tests__/cx-simulation.test.ts` | CX stability over 30/100 days | Simplified review generation, no real engine, no events |

**Rule of thumb:** If a simulation says "everything is fine," verify with the
real engine. If a simulation says "there's a problem," the real engine likely
has it too (possibly worse).
