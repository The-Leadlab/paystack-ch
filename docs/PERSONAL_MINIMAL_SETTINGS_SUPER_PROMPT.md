# Personal minimal UI + Settings tab — Super Prompt

## Goal

Make `/personal` (and `/ali` personal shell) **minimal, clear, and easy**: one job per screen, no duplicate settings chrome on Overview, no long marketing copy on feature tabs.

## Remove from Overview

- **Google Drive (personal)** panel — move to Settings
- **Billing / add-on** block (`PersonalBillingAddons`) — move to Settings  
- Long feature summary, isolation notes, “Explore” quick-link cards
- Extra CTAs that duplicate the sidebar (Invite, Add transaction row if sidebar already has Add)
- AI Savings Coach block (keep Savings/Goals as the place for goals)

Overview should be: **month KPIs → statement upload → compact import list → recent transactions**.

## New Settings tab

Nav item **Settings** (`featureId: settings`) at `/personal/settings` (and `/ali/settings`).

Include:

1. Sessions (personal upload sessions control)
2. Language + theme
3. Google Drive connect/disconnect (personal backups)
4. Household invite
5. Plan add-ons (seat + doc pack) + billing portal
6. Upload usage (e.g. `n/35` across sessions)
7. Link to Business dashboard when allowed

## Clean every other tab

- Drop redundant page intros / feature `summary` paragraphs (shell header already shows the title)
- Drop disabled / decorative buttons (e.g. “12 months” coming soon)
- Keep one primary action area per tab; no duplicate Invite/Drive controls outside Settings
- Header: keep **month** + **refresh** only; move Sessions / language / theme into Settings

## Isolation

Do not route personal data into business Revenue. Do not promote lab-only prototypes into `/app` without user approval.

## Agent checklist

```
1. Write this super prompt.
2. Add Settings to PERSONAL_PLAN_NAV + featureRegistry + panel.
3. Strip Overview Drive/billing/explore/extra copy; wire Settings content.
4. Slim header + sidebar; clean Budget / Reports / Savings / Investments / Bills.
5. Push.
```
