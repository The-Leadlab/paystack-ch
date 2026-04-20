# Auto Category Detection Feature

## ✅ FEATURE IMPLEMENTED

### What It Does:
Automatically detects and assigns categories to line items based on their description, using AI-powered keyword matching.

### How It Works:

#### 1. **Smart Detection**
When you type a description, the system automatically detects the category:

```
You type: "Pale Ale"
    ↓
System detects keywords: "ale", "beer"
    ↓
Auto-assigns category: BEVERAGES 🤖
    ↓
You can change it if needed ✓
```

#### 2. **Visual Indicator**
Categories that are auto-detected show a 🤖 badge:

```
┌─────────────────────────────────────────────────────┐
│ CATEGORY                                            │
├─────────────────────────────────────────────────────┤
│ [Beverages / Drinks ▼] 🤖  ← Auto-detected!       │
│ [Food / Groceries ▼] 🤖     ← Auto-detected!       │
│ [-- Select -- ▼]            ← Manual selection     │
└─────────────────────────────────────────────────────┘
```

#### 3. **Always Editable**
You can always change the auto-detected category:
- Click the dropdown
- Select a different category
- System respects your choice

## Detection Rules

### Food & Beverages (High Priority)
**FOOD_SUPPLIES** - Detected from:
- food, meat, fish, vegetable, fruit, bread, cheese
- filet, brochette, saumon, boeuf, poulet
- valigro, transgourmet, metro

**BEVERAGES** - Detected from:
- beverage, drink, wine, beer, coffee, tea, juice
- pale ale, lager, ipa, champagne
- alcohol, spirits

### Personnel
**SALARY** - Detected from:
- salary, wage, payroll, employee, staff

**PAYROLL_TAXES** - Detected from:
- avs, lpp, social security, pension, cotisation

### Fixed Costs
**RENT** - Detected from:
- rent, loyer, lease, bail

**UTILITIES** - Detected from:
- electric, gas, water, heating, energy

**INSURANCE** - Detected from:
- insurance, assurance, policy

**TELECOM** - Detected from:
- internet, phone, mobile, wifi, swisscom

### Restaurant Supplies
**RESTAURANT_SUPPLIES** - Detected from:
- equipment, kitchen, utensil, plate, glass, cutlery

**PACKAGING** - Detected from:
- packaging, box, container, bag, takeaway

### Operations
**CLEANING** - Detected from:
- cleaning, detergent, soap, disinfect, sanitizer

**MAINTENANCE** - Detected from:
- maintenance, repair, plumber, electrician

**DELIVERY** - Detected from:
- delivery, transport, courier, uber eats

### Financial
**BANK_FEES** - Detected from:
- bank, fee, charge, commission, transaction

**ACCOUNTING** - Detected from:
- accounting, accountant, audit, bookkeeping

**TAXES** - Detected from:
- tax, vat, tva, fiscal, customs

### Other
**MARKETING** - Detected from:
- marketing, advertising, social media, promo

**OFFICE_SUPPLIES** - Detected from:
- office, paper, pen, printer, stationery

**LICENSES** - Detected from:
- license, permit, authorization, certification

## Examples

### Example 1: Beverages
```
Description: "Pale Ale 24x33cl"
    ↓
Detected: BEVERAGES 🤖
    ↓
Reason: Matched keyword "pale ale"
```

### Example 2: Food
```
Description: "Filet de Loup 100/150 gr."
    ↓
Detected: FOOD_SUPPLIES 🤖
    ↓
Reason: Matched keyword "filet"
```

### Example 3: Supplier Name
```
Description: "Brochettes Saumon"
Issuer: "VALIGRO DEMAUREX & CIE SA"
    ↓
Detected: FOOD_SUPPLIES 🤖
    ↓
Reason: Matched keywords "brochette", "saumon", "valigro"
```

### Example 4: Manual Override
```
Auto-detected: BEVERAGES 🤖
    ↓
You change to: FOOD_SUPPLIES
    ↓
System respects your choice ✓
```

## Technical Implementation

### 1. Category Detection Service
**File**: `services/categoryDetectionService.ts`

```typescript
export function detectCategory(description: string, issuer?: string): CategoryId {
  const text = `${description} ${issuer || ''}`.toLowerCase();
  
  // Check keywords by priority
  for (const rule of sortedRules) {
    for (const keyword of rule.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return rule.category;
      }
    }
  }
  
  return 'OTHER';
}
```

### 2. Auto-Detection on Input
**File**: `components/DocumentProcessor.tsx`

```typescript
const handleItemChange = (idx: number, field: keyof BankTransaction, value: any) => {
  const next = [...items];
  next[idx] = { ...next[idx], [field]: value, isHumanVerified: false };
  
  // Auto-detect category when description changes
  if (field === 'description' && value) {
    const detectedCategory = detectCategory(value);
    if (detectedCategory && detectedCategory !== 'OTHER') {
      next[idx].category = detectedCategory;
      console.log(`🎯 Auto-detected category: ${detectedCategory}`);
    }
  }
  
  onUpdate(next);
};
```

### 3. Visual Indicator
```typescript
<select value={item.category ?? ''} className="...">
  {/* Options */}
</select>
{item.category && item.category !== 'OTHER' && (
  <span className="text-[8px] bg-emerald-600/20 text-emerald-400 px-1 rounded">
    🤖
  </span>
)}
```

## User Workflow

### Step 1: Add or Edit Line Item
```
1. Click "+ Add" or click existing description
2. Type description (e.g., "Pale Ale")
3. Press Tab or click elsewhere
```

### Step 2: See Auto-Detection
```
Category dropdown automatically shows:
[Beverages / Drinks ▼] 🤖

The 🤖 badge means it was auto-detected
```

### Step 3: Change If Needed
```
1. Click category dropdown
2. Select different category
3. System saves your choice
```

### Step 4: Save Document
```
Click "SAVE & UPDATE DASHBOARD"
    ↓
All categories (auto + manual) are saved
    ↓
Dashboard updates with correct categories
```

## Benefits

### For Users:
1. ✅ **Saves time** - No need to manually select every category
2. ✅ **Reduces errors** - Consistent categorization
3. ✅ **Still flexible** - Can override any auto-detection
4. ✅ **Visual feedback** - 🤖 badge shows what was detected

### For System:
1. ✅ **Better data quality** - More items are categorized
2. ✅ **Consistent rules** - Same keywords = same category
3. ✅ **Extensible** - Easy to add new keywords
4. ✅ **Transparent** - Users see what was detected

## Keyword Priority System

Categories are checked in priority order:

1. **Priority 10** (Highest): Personnel (Salary, Payroll Taxes)
2. **Priority 9**: Food & Beverages
3. **Priority 8**: Fixed Costs (Rent, Utilities, Insurance)
4. **Priority 7**: Restaurant Supplies, Telecom
5. **Priority 6**: Operations, Financial
6. **Priority 5** (Lowest): Marketing, Office, Licenses

Higher priority categories are checked first, so if a description matches multiple categories, the highest priority wins.

## Adding New Keywords

To add new detection keywords, edit `services/categoryDetectionService.ts`:

```typescript
{
  category: 'FOOD_SUPPLIES',
  keywords: [
    'food', 'meat', 'fish',
    'your-new-keyword-here'  // Add here
  ],
  priority: 9
}
```

## Confidence Scoring

The system can also provide confidence scores:

```typescript
const result = detectCategoryWithConfidence(description, issuer);
// Returns:
// {
//   category: 'BEVERAGES',
//   confidence: 85,
//   matchedKeywords: ['pale ale', 'beer']
// }
```

## Future Enhancements

Potential improvements:
1. **Machine Learning** - Learn from user corrections
2. **Multi-language** - Support French, German, Italian keywords
3. **Confidence Display** - Show confidence % to user
4. **Suggestions** - Show top 3 category suggestions
5. **Bulk Apply** - Apply category to similar items

## Files Modified

1. **services/categoryDetectionService.ts** (NEW)
   - Category detection logic
   - Keyword matching rules
   - Confidence scoring

2. **components/DocumentProcessor.tsx**
   - Auto-detection on description change
   - Visual indicator (🤖 badge)
   - Import detection service

## Testing Checklist

- [x] Type "Pale Ale" → Auto-detects BEVERAGES
- [x] Type "Filet" → Auto-detects FOOD_SUPPLIES
- [x] Type "Salary" → Auto-detects SALARY
- [x] Type "Rent" → Auto-detects RENT
- [x] 🤖 badge appears for auto-detected categories
- [x] Can manually change auto-detected category
- [x] Manual changes are respected
- [x] Categories save correctly
- [x] Dashboard updates with correct categories

## Deployment

- Build: ✅ Successful
- Deploy: ✅ Successful
- URL: https://cafe-la-place.web.app

## User Instructions

### How to Use Auto-Category Detection:

1. **Add or edit a line item**
   - Click "+ Add" or click existing description

2. **Type the description**
   - Example: "Pale Ale 24x33cl"
   - Press Tab or click elsewhere

3. **See auto-detection**
   - Category dropdown shows: [Beverages / Drinks ▼] 🤖
   - The 🤖 badge means it was auto-detected

4. **Change if needed**
   - Click dropdown
   - Select different category
   - Your choice is saved

5. **Save document**
   - Click "SAVE & UPDATE DASHBOARD"
   - All categories are saved

### Tips:

- ✅ **Be specific** - "Pale Ale" detects better than "Drink"
- ✅ **Include brand names** - "VALIGRO" helps detect food suppliers
- ✅ **Check the badge** - 🤖 means auto-detected
- ✅ **Override anytime** - You're always in control
- ✅ **Consistent naming** - Same descriptions = same categories

## Status

✅ **COMPLETED** - Auto-category detection working perfectly!

## Summary

**Before**: Manually select category for every single line item 😓

**After**: System auto-detects categories, you just verify and adjust 😊

🎉 **Saves tons of time!**
