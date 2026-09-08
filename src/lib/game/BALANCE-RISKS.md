# Balance Risks & Known Issues

> Last updated: Pre-Phase 3 stabilization pass

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
They are useful for:
- Quick sanity checks during development
- Catching infinite growth / universal bankruptcy
- Verifying personality behavioral differences

They are NOT suitable for:
- Final balance tuning
- Accurate payback period estimates
- Determining if a business type is "too strong" or "too weak"

**Always validate balance changes against the real game engine running with a
database, or observe live gameplay metrics before adjusting economy constants.**

### 4. No aiProfitCenter / aiProfitRange
These fields were originally defined in `economy-config.ts` but were never
consumed by the AI engine. AI profit behavior is now controlled per-personality
via `PERSONALITY_CONFIGS` in `ai-strategy.ts`. The unused config fields have
been removed and documented.

### 5. Personality Dominance Risk
If one personality type consistently outperforms others by >3x in net worth
over 100 days, the `PERSONALITY_CONFIGS` weights should be adjusted. The
simulation checks for this, but real-engine results may differ due to events
and human player interaction.

### 6. Market Share Stability
Market share is recalculated per tick using attractiveness scores. Rapid
price changes by multiple AI players in the same tick can cause share
fluctuations. This is expected behavior but should be monitored.

## Simulation Files & Their Limitations

| File | Purpose | Limitation |
|------|---------|------------|
| `ai/ai-simulation-test.ts` | AI personality balance over 100 days | No events, no market prices, simplified sales, no human players |
| `economy/balance-sim.ts` | Per-business-type profitability | No employees, auto-restock, no events, no competition |

**Rule of thumb:** If a simulation says "everything is fine," verify with the
real engine. If a simulation says "there's a problem," the real engine likely
has it too (possibly worse).
