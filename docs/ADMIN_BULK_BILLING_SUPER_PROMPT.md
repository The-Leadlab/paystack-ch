# Admin bulk actions + stop Stripe for admins/test mode — Super Prompt

Use when changing User Management so ops can safely grant admin/test access without accidental charges, and run bulk actions.

---

## Goals

1. **Stop Stripe charging** when a user is turned into a **platform admin** (`appAdmin`) or put into **plan test mode** (`planTestMode`).
2. **Confirm** (warning dialog) before making someone an admin — mention that any live Stripe subscription will be canceled immediately.
3. **Bulk selection** in the users table: select all (current list), then:
   - Make admins (with confirm + Stripe cancel)
   - Delete users (with confirm)
   - Archive (disable) selected users
   - Quick helper: select / archive users with **no subscription** (“inactive”)

---

## Billing rules

When enabling `appAdmin` **or** enabling `planTestMode` (via `set_plan`):

1. If Firestore has `subscriptionId`, cancel that Stripe subscription **immediately** (`invoice_now: false`, `prorate: false`) — same as trial cancel path.
2. Clear billing fields: `subscriptionStatus: "none"`, `subscriptionId: null`, `stripe` period/trial fields cleared as needed; keep `planId` for test mode entitlements when test mode is on.
3. For **admin**: keep `appAdmin: true`; do not require a paid plan.
4. For **test mode**: set `planTestMode: true` and `subscriptionStatus: "active"` only as a **simulated** status in-app (no Stripe sub). Prefer documenting that simulated status is not a Stripe charge.
5. Removing admin or turning off test mode does **not** recreate a Stripe subscription.

---

## UI

1. Per-row Admin checkbox → confirm dialog before enable.
2. Row checkboxes + **Select all** for the visible tab list.
3. Bulk bar when selection non-empty: Make admin | Archive | Delete | Clear selection.
4. Optional: “Select no-subscription” to select users without live Stripe status.

---

## Out of scope

- Changing `ADMIN_ACCESS_PASSWORD` / Edge gate for `/admin`
- Refunding past invoices automatically (cancel future only)

---

## Agent checklist

- [ ] Shared server helper cancels Stripe on admin / test-mode enable
- [ ] Confirm dialog copy EN + FR
- [ ] Bulk select + actions in `AdminUsersPanel`
- [ ] Push
