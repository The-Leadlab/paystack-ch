# Collapsible icon-rail sidebar — Super Prompt

## Goal

Apollo-style desktop sidebar: collapse to slim icon-only rail; expand to full labels. Content expands with the remaining width. Apply to **Personal** and **Business**.

## Behavior

- Toggle `<<` / `>>` in sidebar head
- Persist: `paystack-personal-sidebar-collapsed` / `paystack-business-sidebar-collapsed`
- Collapsed ~56–64px icons only; expanded ~208–256px
- Mobile slide-in unchanged

## Files

- Personal: `PersonalPlanSidebar.tsx`, `PersonalPlanShell.tsx`
- Business: `RestaurantDashboard.tsx`, `BusinessSidebarNav.tsx`, `businessApp.css`
