# Task 7 - Simulation Runner Agent

## Task: Create and Run Long-Term Simulation + Lint Check

### Completed Actions:

1. **Created simulation script**: `/home/z/my-project/src/lib/game/ai/ai-simulation-test.ts`
   - Deterministic 100-day simulation using SeededRNG (Mulberry32 PRNG, seed=42)
   - 8 AI players matching seedAIPlayers personalities
   - Full economy simulation per business per day
   - AI decision engine (evaluateActions + selectBestAction) per player per day
   - 6 tracked metrics: netWorth, cash, dailyProfit, businessCount, loanCount, inventoryAvg

2. **Ran simulation**: `npx tsx src/lib/game/ai/ai-simulation-test.ts`

3. **Ran lint**: `bun run lint` → zero errors

4. **Ran tests**: `bun run test` → 105/105 passing

### Key Findings:

**Critical Balance Issue: AI Death Spiral**
- 6 of 8 AI players go bankrupt by Day 100
- Root cause: inventory depletion → revenue crash → can't afford restock → expenses continue → net worth decline
- Only 2 players survive (those with highest initial cash)
- CoV (coefficient of variation) = 10.54 — extreme net worth divergence
- AGGRESSIVE and TRADER personalities fare worst (lowest cash reserves)
- CONSERVATIVE and BALANCED survive longest (highest cash reserves)

**No infinite growth patterns detected** — the economy's "no guaranteed profit" design works as intended.

**Recommendation**: AI needs emergency restocking logic (e.g., always restock essentials when cash > 2× restock cost, regardless of cashReserveRatio).
