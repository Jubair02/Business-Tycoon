# Task 5: Phase 4 - Integrate Marketing into Game Engine

## Summary
Integrated the marketing system (Phase 4) into the game engine's `simulateBusinessTick()` pipeline.

## Changes Made

### File: `/home/z/my-project/src/lib/game-engine.ts`

1. **Imports (lines 62-73)**: Added Phase 4 marketing imports after Phase 3 CX imports
   - 8 formula functions from `marketing-formulas.ts`
   - `MARKETING_CONFIG` from `marketing-config.ts`

2. **New function `processMarketingTick()` (lines 282-424)**:
   - Processes all ACTIVE campaigns for a business
   - No campaigns → decay brand awareness, return neutral modifiers
   - Per campaign: daily spend (budget-clamped), reach, conversions, demand modifier, effectiveness
   - Updates campaign records and creates CampaignMetric daily records
   - Auto-completes expired campaigns (daysRun >= duration)
   - Returns combined demand modifier, total spend, new brand awareness, conversions, reach

3. **`simulateBusinessTick()` modifications**:
   - **Step 0.6** (new): Fetches gameDay early, calls processMarketingTick
   - **potentialCustomers**: Now includes `marketingDemandModifier × brandAwarenessBonus`
   - **Step 4**: Net profit calculated with `totalExpenseWithMarketing`
   - **Business update**: Includes `brandAwareness`, `dailyExpense` includes marketing
   - **Player cash**: Marketing spend deducted separately after profit distribution
   - **BusinessMetric**: Expenses include marketing spend
   - **Game log**: Includes marketing spend (Mkt ৳...)

## Verification
- `bun run lint`: 0 errors
- All existing Phase 1-3 functionality preserved unchanged
