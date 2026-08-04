# Super prompt: Admin user settings UX

## Goal

When an admin opens a user from **User management**, the detail screen must have a clear way back to the full user list, and the settings layout must be easier to scan and act on.

## Problems

1. Back control exists but is easy to miss (ghost button, weak label).
2. Billing tab mixes status, Stripe link, cancel/refund, coupons, and plan override in one long scroll.
3. Actions tab mixes password reset, verification, enable/disable, and delete without a clear danger zone.
4. Profile lacks a quick identity snapshot (who is this user?) above the edit form.

## Requirements

### Back navigation

- Always-visible top bar on the user detail view.
- Primary control: **All users** (or equivalent i18n) with arrow icon, outline style — not ghost-only.
- Clicking it returns to the searchable user table (`selectedUid = null`).
- Keep Refresh next to it for convenience.

### Layout

1. **Identity header** — display name / email, UID (copyable), plan + status + verified + disabled chips.
2. **Tabs** — Profile | Billing | Security | Invoices (rename Actions → Security).
3. **Profile** — read-only account snapshot, then edit form (name, email, phone, flags, save).
4. **Billing** — section cards: Overview → Stripe link/repair → Subscription actions → Coupon → Plan override.
5. **Security** — Access links → Set password → Danger zone (disable / delete).
6. **Invoices** — unchanged behavior; clearer empty states.

### i18n

Add/update EN + FR keys in `LanguageContext` for new labels (All users, section titles, Security tab, danger zone, etc.).

### Out of scope

- New admin APIs or billing logic changes.
- Changing list search / create-user flows beyond minor copy.

## Acceptance

- From user detail, one obvious click returns to all users.
- Billing and security actions are grouped under clear headings.
- No regression to existing admin actions (save profile, Stripe link, cancel, refund, coupon, plan, password, disable, delete, invoices).
