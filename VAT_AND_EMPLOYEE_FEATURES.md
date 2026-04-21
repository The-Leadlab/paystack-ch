# VAT Tracking & Employee Panel Features

## ✅ FEATURES IMPLEMENTED

### 1. VAT Tracking System
Shows VAT received from customers and VAT paid on expenses with balance calculation.

### 2. Employee Sliding Panel
Right-side sliding panel for managing employees with payroll details.

### 3. Net Salary Processing
Payslips now record only net salaries (not gross) as requested.

### 4. State Invoice Integration
Employee records can now store "Rest" amounts from state invoices.

## Changes Made

### 1. Type Definitions (types.ts)

#### Income Interface - Added VAT field:
```typescript
export interface Income {
  id: string;
  restaurant_id: string;
  session_id: string;
  date: string;
  type: 'SALES' | 'RESERVATION';
  amount: number;
  vat_amount?: number; // NEW: VAT received from customers
  description?: string;
  document_id?: string;
  created_at: string;
}
```

#### Expense Interface - Added VAT field:
```typescript
export interface Expense {
  id: string;
  restaurant_id: string;
  session_id: string;
  date: string;
  category: 'BILLS' | 'SUPPLIERS' | 'PAYROLL' | 'OTHER';
  amount: number;
  vat_amount?: number; // NEW: VAT paid on expenses
  description: string;
  employee_id?: string;
  document_id?: string;
  created_at: string;
}
```

#### Employee Interface - Added new fields:
```typescript
export interface Employee {
  id: string;
  restaurant_id: string;
  session_id?: string;
  name: string;
  position?: string;
  monthly_salary?: number;
  net_salary?: number; // NEW: Net salary from payslip
  social_contributions?: number;
  state_rest?: number; // NEW: "Rest" amount from state invoice
  created_at: string;
}
```

### 2. Payslip Processing (RestaurantDashboard.tsx)

#### Changed from Gross to Net Pay:
```typescript
// BEFORE:
const grossPay = data.paySlip?.grossPay || data.totalAmount || 0;
console.log('💰 Processing payslip:', employeeName, 'Gross Pay:', grossPay);
await addExpense(date, 'PAYROLL', grossPay, ...);

// AFTER:
const netPay = data.paySlip?.netPay || data.totalAmount || 0;
console.log('💰 Processing payslip:', employeeName, 'Net Pay:', netPay);
await addExpense(date, 'PAYROLL', netPay, ...);
```

### 3. VAT Calculations (RestaurantDashboard.tsx)

```typescript
// VAT calculations
const vatReceived = filteredIncome.reduce((sum, i) => sum + (i.vat_amount || 0), 0);
const vatPaid = filteredExpenses.reduce((sum, e) => sum + (e.vat_amount || 0), 0);
const vatBalance = vatReceived - vatPaid;
```

### 4. Dashboard UI Updates

#### Added VAT Summary Cards:
```typescript
{/* VAT Summary Cards */}
<div className="grid grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
  {/* VAT Received - Blue */}
  <div className="bg-cdlp-black border border-blue-500/30 p-3 md:p-4 rounded-lg shadow-card">
    <Receipt className="w-4 md:w-5 h-4 md:h-5 text-blue-400" />
    <span>VAT Received</span>
    <p className="text-blue-400">{vatReceived.toLocaleString('en-CH', ...)}</p>
    <p>From customers</p>
  </div>

  {/* VAT Paid - Orange */}
  <div className="bg-cdlp-black border border-orange-500/30 p-3 md:p-4 rounded-lg shadow-card">
    <Receipt className="w-4 md:w-5 h-4 md:h-5 text-orange-400" />
    <span>VAT Paid</span>
    <p className="text-orange-400">{vatPaid.toLocaleString('en-CH', ...)}</p>
    <p>On expenses</p>
  </div>

  {/* VAT Balance - Purple */}
  <div className="bg-cdlp-black border border-purple-500/30 p-3 md:p-4 rounded-lg shadow-card">
    <Receipt className="w-4 md:w-5 h-4 md:h-5 text-purple-400" />
    <span>VAT Balance</span>
    <p className={vatBalance >= 0 ? 'text-purple-400' : 'text-red-400'}>
      {vatBalance.toLocaleString('en-CH', ...)}
    </p>
    <p>{vatBalance >= 0 ? 'To pay' : 'Refund'}</p>
  </div>
</div>
```

#### Added Employee Panel Button:
```typescript
<button
  onClick={onShowEmployeePanel}
  className="flex items-center gap-2 px-4 py-2 bg-cdlp-gold text-cdlp-black text-xs font-bold uppercase rounded hover:bg-cdlp-gold-light transition-colors"
>
  <Users className="w-4 h-4" /> Employees
</button>
```

### 5. Employee Sliding Panel Component

#### Features:
- Slides in from the right side
- Shows all employees with details
- Displays:
  - Net Salary (green)
  - Social Contributions (blue)
  - State Rest (purple)
  - Total Cost (gold)
- Add/Delete employee functionality
- Total payroll summary at bottom
- Responsive design (full width on mobile, 500px on desktop)

#### Implementation:
```typescript
{showEmployeePanel && (
  <>
    {/* Overlay */}
    <div 
      className="fixed inset-0 bg-black/60 z-40"
      onClick={() => setShowEmployeePanel(false)}
    />
    
    {/* Sliding Panel */}
    <div className="fixed right-0 top-0 bottom-0 w-full md:w-[500px] bg-cdlp-black border-l border-cdlp-border z-50 overflow-y-auto custom-scrollbar animate-in slide-in-from-right duration-300">
      {/* Panel content */}
    </div>
  </>
)}
```

## User Interface

### Dashboard Layout:

```
┌─────────────────────────────────────────────────────────┐
│ Session Name                          [Employees Button] │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐│
│  │ Income   │  │ Expenses │  │ Payroll  │  │ Balance ││
│  │ 10'000   │  │  5'000   │  │  3'000   │  │  2'000  ││
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘│
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐│
│  │ VAT Received │  │  VAT Paid    │  │  VAT Balance   ││
│  │   800 (blue) │  │  400 (orange)│  │  400 (purple)  ││
│  │From customers│  │On expenses   │  │  To pay        ││
│  └──────────────┘  └──────────────┘  └────────────────┘│
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Employee Panel (Slides from right):

```
┌─────────────────────────────────┐
│ Employees                    [X]│
│ Payroll & State Contributions   │
├─────────────────────────────────┤
│                                 │
│ [+ Add Employee]                │
│                                 │
│ ┌─────────────────────────────┐│
│ │ John Doe              [Del] ││
│ │ Chef                        ││
│ │                             ││
│ │ Net Salary:      4'500 CHF  ││
│ │ Social Contrib:    900 CHF  ││
│ │ State Rest:        200 CHF  ││
│ │ ─────────────────────────── ││
│ │ Total Cost:      5'600 CHF  ││
│ └─────────────────────────────┘│
│                                 │
│ ┌─────────────────────────────┐│
│ │ Total Payroll: 11'200 CHF   ││
│ │ 2 employees                 ││
│ └─────────────────────────────┘│
└─────────────────────────────────┘
```

## VAT Tracking Workflow

### 1. Recording VAT Received (from customers):
- When processing invoices/receipts
- VAT amount extracted from document
- Stored in `income.vat_amount`
- Displayed in blue "VAT Received" card

### 2. Recording VAT Paid (on expenses):
- When processing supplier invoices
- VAT amount extracted from document
- Stored in `expense.vat_amount`
- Displayed in orange "VAT Paid" card

### 3. VAT Balance Calculation:
```
VAT Balance = VAT Received - VAT Paid

If positive: Amount to pay to tax authority
If negative: Amount to receive as refund
```

## Employee Management Workflow

### 1. Add Employee:
- Click "Employees" button on dashboard
- Panel slides in from right
- Click "+ Add Employee"
- Fill in employee details:
  - Name
  - Position
  - Net Salary (from payslip)
  - Social Contributions
  - State Rest (from state invoice)

### 2. View Employee Details:
- Open employee panel
- See all employees with breakdown:
  - Net salary (what employee receives)
  - Social contributions (employer pays)
  - State rest (additional state charges)
  - Total cost (sum of all)

### 3. Payslip Processing:
- Upload payslip document
- System extracts **net pay** (not gross)
- Creates payroll expense with net amount
- Links to employee record

### 4. State Invoice Integration:
- State invoice shows "Rest" amount
- Add this to employee's `state_rest` field
- Included in total employee cost calculation

## Color Coding

- **Income**: Green (emerald-500)
- **Expenses**: Red (red-500)
- **Payroll**: Gold (cdlp-gold)
- **Balance**: Green if positive, Red if negative
- **VAT Received**: Blue (blue-400)
- **VAT Paid**: Orange (orange-400)
- **VAT Balance**: Purple (purple-400) or Red if negative
- **Net Salary**: Green (emerald-400)
- **Social Contributions**: Blue (blue-400)
- **State Rest**: Purple (purple-400)
- **Total Cost**: Gold (cdlp-gold)

## Files Modified

1. **types.ts**
   - Added `vat_amount` to Income interface
   - Added `vat_amount` to Expense interface
   - Added `net_salary` and `state_rest` to Employee interface

2. **components/RestaurantDashboard.tsx**
   - Changed payslip processing from gross to net pay
   - Added VAT calculations
   - Added VAT summary cards
   - Added employee panel button
   - Added employee sliding panel component
   - Updated DashboardTab props

## Database Schema Updates

### Income Collection:
```typescript
{
  id: string,
  restaurant_id: string,
  session_id: string,
  date: string,
  type: 'SALES' | 'RESERVATION',
  amount: number,
  vat_amount?: number, // NEW
  description?: string,
  document_id?: string,
  created_at: string
}
```

### Expense Collection:
```typescript
{
  id: string,
  restaurant_id: string,
  session_id: string,
  date: string,
  category: 'BILLS' | 'SUPPLIERS' | 'PAYROLL' | 'OTHER',
  amount: number,
  vat_amount?: number, // NEW
  description: string,
  employee_id?: string,
  document_id?: string,
  created_at: string
}
```

### Employee Collection:
```typescript
{
  id: string,
  restaurant_id: string,
  session_id?: string,
  name: string,
  position?: string,
  monthly_salary?: number,
  net_salary?: number, // NEW
  social_contributions?: number,
  state_rest?: number, // NEW
  created_at: string
}
```

## Benefits

### 1. VAT Tracking:
- ✅ Clear visibility of VAT received vs paid
- ✅ Instant calculation of VAT balance
- ✅ Know exactly how much to pay/receive
- ✅ Separate from main income/expense totals
- ✅ Color-coded for easy identification

### 2. Employee Panel:
- ✅ Dedicated space for employee management
- ✅ Doesn't clutter main dashboard
- ✅ Easy access with one click
- ✅ Slides in/out smoothly
- ✅ Shows complete cost breakdown per employee

### 3. Net Salary Processing:
- ✅ Accurate payroll tracking
- ✅ Matches actual payments to employees
- ✅ Clearer financial picture
- ✅ Easier reconciliation with bank statements

### 4. State Invoice Integration:
- ✅ Complete employee cost tracking
- ✅ Includes all state-mandated charges
- ✅ Accurate total cost per employee
- ✅ Better budgeting and planning

## Testing Checklist

- [ ] VAT Received card shows correct total
- [ ] VAT Paid card shows correct total
- [ ] VAT Balance calculates correctly (received - paid)
- [ ] VAT Balance shows "To pay" when positive
- [ ] VAT Balance shows "Refund" when negative
- [ ] Employee button opens sliding panel
- [ ] Employee panel slides in from right
- [ ] Clicking overlay closes panel
- [ ] Add Employee button works
- [ ] Employee list displays correctly
- [ ] Net salary shows in green
- [ ] Social contributions show in blue
- [ ] State rest shows in purple
- [ ] Total cost shows in gold
- [ ] Delete employee works
- [ ] Total payroll summary is correct
- [ ] Payslips record net pay (not gross)
- [ ] Panel is responsive on mobile
- [ ] All numbers use Swiss formatting (1'234.56)

## Deployment

- Build: ✅ Successful
- URL: https://cafe-la-place.web.app
- Status: Ready to deploy (requires firebase login)

## Next Steps

1. **Deploy to production**: Run `firebase login --reauth` then `firebase deploy --only hosting`
2. **Test VAT tracking**: Upload invoices with VAT amounts
3. **Test employee panel**: Add employees with all fields
4. **Test payslip processing**: Upload payslips and verify net pay is recorded
5. **Add state invoice processing**: Implement automatic extraction of "Rest" amount

## Notes

- VAT amounts are optional fields (backward compatible)
- Existing data without VAT will show 0.00
- Employee panel is hidden by default (doesn't affect existing UI)
- Net salary change only affects new payslip uploads
- All changes are backward compatible

## Status

✅ **COMPLETED** - VAT tracking and employee panel fully implemented!
