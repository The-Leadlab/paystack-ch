# All Sessions View - Orphaned Data Fix

## Date: April 16, 2026

## Problem
The "All Sessions" view was showing cumulative data from ALL sessions in the database, including data from deleted sessions. This caused:
- Numbers kept increasing even after deleting sessions
- "Delete All Data" didn't fully clean up
- Orphaned income/expense entries remained in database
- Confusing totals that didn't match visible sessions

## Root Causes

### 1. Incomplete Session Deletion
When deleting a session, only the session document was deleted, but:
- ❌ Income entries remained (with deleted session_id)
- ❌ Expense entries remained (with deleted session_id)
- ❌ POS readings remained (with deleted session_id)
- ❌ Documents remained (with deleted session_id)

### 2. All Sessions View Showed Orphaned Data
The filtering logic was:
```typescript
// OLD - Shows ALL data including orphaned entries
const filteredIncome = isAllSessionsView 
  ? income  // Shows everything!
  : income.filter(i => i.session_id === currentSession?.id);
```

This meant "All Sessions" showed data from sessions that no longer exist!

## Solutions Implemented

### 1. Cascade Delete on Session Removal
Updated `SessionContext.tsx` to use batch deletion:

```typescript
const deleteSession = async (id: string) => {
  const batch = writeBatch(db);
  
  // Delete session
  batch.delete(doc(db, 'sessions', id));
  
  // Delete all income for this session
  const incomeSnap = await getDocs(
    query(collection(db, 'income'), where('sessionId', '==', id))
  );
  incomeSnap.forEach(doc => batch.delete(doc.ref));
  
  // Delete all expenses for this session
  const expensesSnap = await getDocs(
    query(collection(db, 'expenses'), where('sessionId', '==', id))
  );
  expensesSnap.forEach(doc => batch.delete(doc.ref));
  
  // Delete all POS readings for this session
  const posSnap = await getDocs(
    query(collection(db, 'pos_readings'), where('sessionId', '==', id))
  );
  posSnap.forEach(doc => batch.delete(doc.ref));
  
  // Delete all documents for this session
  const docsSnap = await getDocs(
    query(collection(db, 'documents'), where('session_id', '==', id))
  );
  docsSnap.forEach(doc => batch.delete(doc.ref));
  
  // Commit all deletions atomically
  await batch.commit();
};
```

**Benefits:**
- ✅ Complete cleanup when deleting a session
- ✅ No orphaned data left behind
- ✅ Atomic operation (all or nothing)
- ✅ Faster than individual deletes

### 2. Filter All Sessions View by Existing Sessions
Updated filtering logic in all components:

**RestaurantDashboard.tsx:**
```typescript
// NEW - Only shows data from existing sessions
const existingSessionIds = sessions.map(s => s.id);
const filteredIncome = isAllSessionsView 
  ? income.filter(i => existingSessionIds.includes(i.session_id))
  : income.filter(i => i.session_id === currentSession?.id);
```

**Applied to:**
- ✅ Dashboard tab (RestaurantDashboard)
- ✅ Reports tab (ReportsPlaceholder)
- ✅ Revenue tab (POSManager)

**Benefits:**
- ✅ All Sessions view only shows data from active sessions
- ✅ Orphaned data is hidden (not counted)
- ✅ Accurate totals that match visible sessions
- ✅ Consistent behavior across all tabs

## Testing Scenarios

### Scenario 1: Delete Single Session
**Before:**
1. Create Session A with 100 CHF income
2. Create Session B with 200 CHF income
3. All Sessions shows: 300 CHF ✅
4. Delete Session A
5. All Sessions STILL shows: 300 CHF ❌ (orphaned data)

**After:**
1. Create Session A with 100 CHF income
2. Create Session B with 200 CHF income
3. All Sessions shows: 300 CHF ✅
4. Delete Session A
5. All Sessions shows: 200 CHF ✅ (correct!)

### Scenario 2: Delete All Sessions
**Before:**
1. Create multiple sessions with data
2. Click "Delete All Sessions"
3. Sessions deleted but data remains
4. Create new session
5. All Sessions shows old data ❌

**After:**
1. Create multiple sessions with data
2. Click "Delete All Sessions"
3. Sessions AND all data deleted ✅
4. Create new session
5. All Sessions shows: 0 CHF ✅ (clean slate)

### Scenario 3: Reset All Data
**Before:**
1. Data from deleted sessions persists
2. "Reset All Data" doesn't clean everything
3. Numbers keep accumulating ❌

**After:**
1. "Reset All Data" removes everything
2. Clean database state ✅
3. Fresh start with new sessions ✅

## What Gets Deleted

When you delete a session, the following are CASCADE DELETED:

| Collection | Field | Action |
|------------|-------|--------|
| `sessions` | `id` | ✅ Deleted |
| `income` | `sessionId` | ✅ Deleted |
| `expenses` | `sessionId` | ✅ Deleted |
| `pos_readings` | `sessionId` | ✅ Deleted |
| `documents` | `session_id` | ✅ Deleted |

## Performance Considerations

**Batch Operations:**
- All deletions happen in a single batch
- Atomic transaction (all succeed or all fail)
- More efficient than individual deletes
- Reduces Firestore read/write costs

**Filtering:**
- Minimal overhead (just array filtering)
- Happens in memory (no extra database queries)
- Fast even with many sessions

## User Experience Improvements

### Before Fix:
- ❌ Confusing numbers that don't match
- ❌ Data persists after deletion
- ❌ "All Sessions" shows ghost data
- ❌ Can't get clean slate

### After Fix:
- ✅ Accurate totals always
- ✅ Complete cleanup on delete
- ✅ "All Sessions" shows only active data
- ✅ Fresh start when needed

## Migration Notes

**Existing Data:**
- Old orphaned data may still exist in database
- Will be hidden from "All Sessions" view
- Can be cleaned up manually if needed
- New deletions will be complete

**No Breaking Changes:**
- Existing sessions work normally
- No data loss for active sessions
- Backward compatible

## Deployment

**Build Status:** ✅ Successful
**Deploy Status:** ✅ Successful
**Production URL:** https://cafe-la-place.web.app

## Summary

The "All Sessions" view now correctly:
1. ✅ Only shows data from existing sessions
2. ✅ Hides orphaned data from deleted sessions
3. ✅ Provides accurate totals
4. ✅ Completely removes data when deleting sessions
5. ✅ Gives clean slate when resetting

**The numbers will now match what you expect!** 🎉
