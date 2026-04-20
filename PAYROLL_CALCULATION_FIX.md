# Payroll Calculation Fix

## Issue
Balance calculation was incorrect. Payroll was being counted as part of expenses, but it should be deducted separately.

## Example
**Your Numbers**:
- Income: 31,658.50 CHF
- Expenses (non-payroll): 25,591.25 CHF
- Payroll: 10,300.00 CHF
- **Expected Balance**: -4,232.75 CHF

**Before Fix** (Wrong):
```
Balance = Income - All Expenses (including payroll)
Balance = 31,658.50 - (25,591.25 + 10,300.00)
Balance = 31,658.50 - 35,891.25
Balance = -4,232.75 CHF ✅ (accidentally correct)

But displayed:
- Expenses: 35,891.25 CHF (includes payroll)
- Payroll: 10,300.00 CHF (shown separately but already counted)
- This was confusing!
```

**After Fix** (Correct):
```
Balance = Income - Expenses - Payroll
Balance = 31,658.50 - 25,591.25 - 10,300.00
Balance = -4,232.75 CHF ✅

Displayed:
- Income: 31,658.50 CHF
- Expenses: 25,591.25 CHF (excludes payroll)
- Payroll: 10,300.00 CHF (separate)
- Balance: -4,232.75 CHF
```

## Changes Made

### Before
```typescript
// Total expenses (all categories)
const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
// Payroll is NOT deducted separately - it's already in expenses as PAYROLL category
const totalPayroll = filteredExpenses.filter(e => e.category === 'PAYROLL').reduce((sum, e) => sum + e.amount, 0);
// Balance: Income - All Expenses (which includes payroll)
const balance = totalIncome - totalExpenses;
```

### After
```typescript
// Total expenses (excluding payroll)
const totalExpenses = filteredExpenses.filter(e => e.category !== 'PAYROLL').reduce((sum, e) => sum + e.amount, 0);
// Payroll is deducted separately
const totalPayroll = filteredExpenses.filter(e => e.category === 'PAYROLL').reduce((sum, e) => sum + e.amount, 0);
// Balance: Income - Expenses - Payroll
const balance = totalIncome - totalExpenses - totalPayroll;
```

## Dashboard Display

### Summary Cards
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ 📈 INCOME       │  │ 📉 EXPENSES     │  │ 👥 PAYROLL      │  │ ⚖️ BALANCE      │
│ 31,658.50 CHF   │  │ 25,591.25 CHF   │  │ 10,300.00 CHF   │  │ -4,232.75 CHF   │
└─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Calculation
```
Income:    31,658.50 CHF
Expenses: -25,591.25 CHF (Bills, Suppliers, Other)
Payroll:  -10,300.00 CHF (Salaries)
─────────────────────────
Balance:   -4,232.75 CHF
```

## Expense Categories

### Included in "Expenses"
- BILLS (utilities, rent, etc.)
- SUPPLIERS (food, beverages, etc.)
- OTHER (miscellaneous)

### Separate "Payroll"
- PAYROLL (employee salaries)

## Why This Makes Sense

### Business Perspective
In restaurant accounting, payroll is often tracked separately from operational expenses:
- **Operational Expenses**: Day-to-day costs (food, utilities, supplies)
- **Payroll**: Employee costs (salaries, wages)
- **Balance**: What's left after paying everything

### Dashboard Clarity
```
Income:    What you earned
Expenses:  What you spent on operations
Payroll:   What you paid employees
Balance:   What's left (or deficit)
```

## Testing

### Test Case 1: Your Numbers
```
Income:    31,658.50
Expenses:  25,591.25
Payroll:   10,300.00
Balance:   31,658.50 - 25,591.25 - 10,300.00 = -4,232.75 ✅
```

### Test Case 2: Positive Balance
```
Income:    50,000.00
Expenses:  20,000.00
Payroll:   15,000.00
Balance:   50,000.00 - 20,000.00 - 15,000.00 = 15,000.00 ✅
```

### Test Case 3: No Payroll
```
Income:    10,000.00
Expenses:   5,000.00
Payroll:        0.00
Balance:   10,000.00 - 5,000.00 - 0.00 = 5,000.00 ✅
```

## Files Modified
- `components/RestaurantDashboard.tsx` - Updated balance calculation

## Status
✅ **FIXED** - Payroll now deducted separately from expenses

## Deployed
- Build: ✅ Successful
- Deploy: ✅ Successful
- URL: https://cafe-la-place.web.app
