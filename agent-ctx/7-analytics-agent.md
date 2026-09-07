# Task 7 - Analytics Tab & Business Health Indicators

## Summary
Added a comprehensive Analytics tab and Business Health indicators to the existing `BusinessDetail.tsx` component in the Bangladesh Business Tycoon game.

## Changes Made

### File Modified: `/home/z/my-project/src/components/game/BusinessDetail.tsx`

1. **New Imports**: Added `Activity`, `DollarSign`, `Clock`, `Target` from lucide-react, and `LineChart`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer`, `Legend` from recharts.

2. **New State**: Added `analyticsData` and `analyticsLoading` state variables.

3. **New Fetch Function**: Added `fetchAnalytics()` that calls `/api/businesses/[id]/analytics` endpoint.

4. **Health Score Badge**: Added a colored badge in the business header next to the level badge, showing the health score with color coding (green/emerald/amber/orange/red based on score ranges).

5. **Analytics Tab**: Added as the 3rd tab (between Inventory and Staff), changing the tab grid from 5 to 6 columns. Contains:
   - **Health Score Card**: Large score display with Progress bar, status badge, and positive/negative factor lists.
   - **Financial Breakdown Card**: Revenue, COGS, Gross Profit, Expenses (Rent/Salaries/Utilities/Taxes), Net Profit.
   - **ROI & Payback Card**: Investment, Cumulative Profit, ROI %, Payback days, Avg Daily Profit.
   - **Product Performance Card**: Each product with demand indicator emoji, margin, stock, price score.
   - **Performance History Chart**: Recharts LineChart showing revenue, expenses, and profit over the last 30 days.

6. **Demand Indicators**: On the inventory tab, replaced the old demand label with emoji-based indicators from the analytics API (🔥 Very High / 📈 High / ➡️ Normal / 📉 Low / ❄️ Very Low), falling back to the old label if analytics data isn't available.

7. **API Endpoint**: The endpoint `/api/businesses/[id]/analytics` already existed and returns all the required data structure.

## Health Score Color Scheme
- Excellent (80-100): green
- Healthy (60-79): emerald
- Needs Attention (40-59): amber
- Struggling (20-39): orange
- Critical (0-19): red
