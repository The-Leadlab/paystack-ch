# Cache Refresh Guide - Number Formatting Fix

## Issue
User is seeing numbers without thousand separators (e.g., "3156.60" instead of "3'156.60")

## Root Cause
Browser is showing **cached (old) version** of the application. The fix has been deployed but the browser hasn't downloaded the new version yet.

## Solution: Hard Refresh

### Windows / Linux:
**Chrome / Edge / Firefox:**
- Press `Ctrl + Shift + R`
- OR `Ctrl + F5`

### Mac:
**Chrome / Edge:**
- Press `Cmd + Shift + R`

**Safari:**
- Press `Cmd + Option + R`

**Firefox:**
- Press `Cmd + Shift + R`

## Alternative: Clear Cache

### Chrome / Edge:
1. Press `F12` to open DevTools
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

### Firefox:
1. Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
2. Select "Cached Web Content"
3. Click "Clear Now"
4. Refresh the page

### Safari:
1. Go to Safari menu → Preferences
2. Advanced tab → Check "Show Develop menu"
3. Develop menu → Empty Caches
4. Refresh the page

## Verification

After hard refresh, numbers should show with apostrophes:
- ✅ 3'156.60 (correct)
- ❌ 3156.60 (old cached version)

## For All Users

If multiple users are experiencing this, they ALL need to do a hard refresh to see the updated formatting.

## Technical Details

The formatting code is already deployed and working:
```typescript
{item.amount.toLocaleString('en-CH', { 
  minimumFractionDigits: 2, 
  maximumFractionDigits: 2 
})}
```

This uses Swiss locale (en-CH) which displays apostrophe as thousand separator.

## Production URL
https://cafe-la-place.web.app

Latest deployment includes all number formatting fixes.
