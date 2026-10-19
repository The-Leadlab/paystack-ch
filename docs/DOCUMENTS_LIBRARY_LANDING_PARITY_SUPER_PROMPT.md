# Documents library ↔ landing parity — Super Prompt

**Status:** applied. Align `/app` Documents UI with landing mockups without removing features.

## Goal

Make the in-app **Documents** tab feel like the marketing screenshots: searchable document **card library**, clear header actions, status pills, and Verify — while keeping supplier/employee/POS grouping, Verification Center, and Dashboard upload/processing.

## Design reference

1. Landing **Documents** shot (`screenshot-documents-v7`): grid of file cards (icon, filename, issuer, date/type, amount, Completed pill, Verify).
2. Landing **Expenses** shot: same dark shell, red/blue accents, rounded panels — Documents should share that visual language.

## Rules

1. **Do not remove** upload, AI processing, verification, filters (All / Suppliers / Employees / POS), entity drill-down, or ledger sync.
2. Default browse mode = **Document library** (flat cards). Keep **Group by supplier** as alternate mode.
3. Upload Document CTA may jump to Dashboard upload zone (`data-tour="biz-doc-upload"`).
4. Use `.ba-v3` tokens (`businessApp.css`); support light + dark.
5. Prefer new component `DocumentsLibraryTab.tsx` over growing `RestaurantDashboard.tsx`.

## Key files

| Piece | Location |
|-------|----------|
| Library UI | `client/src/cafe/components/DocumentsLibraryTab.tsx` |
| Styles | `client/src/cafe/businessApp.css` (Documents library block) |
| Shell wiring | `RestaurantDashboard.tsx` → Documents tab |
| i18n | `dashboardTranslations.ts` (`documentsLibrarySubtitle`, `docUploadDocument`, …) |
| Processing table | `DocumentProcessor.tsx` (keep; polish chrome only) |

## Checklist

- [x] Documents tab shows card grid by default
- [x] Search + sort + grid/list work
- [x] Filters still scope suppliers / employees / POS
- [x] Group mode still opens entity → month → cards
- [x] Card / Verify opens VerificationHub; Approve still updates ledger
- [x] Upload Document scrolls to dashboard drop zone
- [x] Pagination footer (range + per-page) matches landing chrome
- [x] Expenses Add / Upload docs CTAs aligned with landing accents
