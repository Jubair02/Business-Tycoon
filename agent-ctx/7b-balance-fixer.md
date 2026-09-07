# Task 7b: Fix AI Inventory Death Spiral

## Agent: balance-fixer

## Changes Made

### 1. Mandatory Inventory Restocking (`ai-engine.ts`)
- Added `performMandatoryRestock(playerId)` function
- Triggers when inventory item < 20% of maxStock
- Restocks to 40% of maxStock (not full — strategic BUY_INVENTORY still needed)
- Uses `db.$transaction` for atomic safety
- Does NOT consume cooldown (not a strategic action)
- Called BEFORE `selectBestAction` in `simulateAIPlayersTick`

### 2. CONSERVATIVE Cooldown Reduction (`ai-strategy.ts`)
- `actionCooldownDays`: 3 → 2

### 3. AI Starting Cash Increase (`game-engine.ts`)
- Range: 400K-1M → 600K-1.2M
- Fixed business type selection: filters for affordable types, tracks `remainingCash`

### 4. Simulation Test Fixes (`ai-simulation-test.ts`)
- Added `performSimMandatoryRestock()` matching real engine logic
- Fixed missing profit distribution (business profit → player cash)
- Updated starting cash to 600K-1.2M
- Updated business type selection to prefer affordable types

## Results
- Lint: clean
- Tests: 105/105 pass
- Simulation: 2 survivors (TRADER ৳842K, BALANCED ৳274K), 1 near-bankruptcy, 5 bankrupt
- Remaining bankruptcies are from economy balance (high-rent business types), NOT inventory death spiral
