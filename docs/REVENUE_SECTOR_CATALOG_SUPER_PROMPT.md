# Revenue Hub — Sector Catalog Super Prompt

Reference: [Ledger onboarding / Change sectors](https://tailored-revenue-hub.lovable.app/) — full industry list (15 sectors).

## Goal

Users must **choose industries from the complete Lovable catalog**, not only the 4 previously hard-coded ones. Selected sectors drive industry modules on `/app` Revenue and stay linked to live income/POS calculations. Keep Paystack branding/colors/fonts.

## Catalog (complete — always listed in “Change sectors”)

| Id | Label |
|----|--------|
| `restaurants` | Restaurants / Bars / Cafés |
| `supermarkets` | Supermarkets |
| `night_shop` | Night shop / Convenience |
| `stadium` | Stadium / Arena |
| `fiduciary` | Fiduciary / Accountants |
| `hotel` | Hotels |
| `gym` | Gyms |
| `salon` | Hairdressers / Beauty |
| `garage` | Garages |
| `medical` | Medical / Dental |
| `fashion` | Fashion Retail |
| `ecommerce` | E-commerce |
| `events` | Events |
| `fuel_station` | Fuel Station |
| `general` | General business |

## UX

1. **Toolbar pills** = only **selected** sectors (active).
2. **Change sectors** opens the **full catalog** checklist (all 15) — toggle on/off.
3. Persist selection in `localStorage` (`paystack.revenue.activeSectors`).
4. First visit / empty selection → open picker automatically; default seed `['restaurants']`.
5. Migrate legacy ids: `garages`→`garage`, `hotels`→`hotel`.

## Data link

- Each selected sector renders an **Industry module** with sector KPIs + 2 breakdown charts.
- Rows matched via description keywords (demo tags + real imports).
- Global Revenue KPIs (today/week/month/YTD, cash, recon) stay session-wide; sector modules are the industry slice.

## Files

- `client/src/cafe/lib/revenueSectors.ts` — catalog + KPIs + matchers
- `client/src/cafe/components/POSManager.tsx` — picker + pills
- `client/src/cafe/components/RevenueIndustryModule.tsx`
- `client/src/cafe/lib/revenueDemoData.ts` — multi-sector demo tags
- `client/src/cafe/i18n/dashboardTranslations.ts` — EN/FR labels
- `docs/REVENUE_HUB_SUPER_PROMPT.md`
