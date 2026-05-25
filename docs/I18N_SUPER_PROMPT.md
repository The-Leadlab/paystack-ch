# Paystack.ch — i18n / Translation Super Prompt

Use this document when fixing **hard-coded copy**, **language switcher bugs**, or **EN/FR mismatches** across the marketing site, production dashboard, and Ali feature lab.

**Surfaces:** `/` (landing), `/app` (dashboard), `/ali` (feature lab). Auth pages (`/sign-in`, `/sign-up`, …) share the same `LanguageContext` as landing.

---

## Architecture (read first)

| Layer | File(s) | Languages | Scope |
|-------|---------|-----------|--------|
| **Production i18n** | `client/src/cafe/context/LanguageContext.tsx` | `en` \| `fr` only | Entire SPA (landing + `/app` + auth) via `LanguageProvider` in `App.tsx` |
| **SEO meta** | `client/src/components/SeoHead.tsx` | `SEO_EN` / `SEO_FR` tables | `document.title`, description, OG tags per route |
| **Ali lab i18n** | `client/src/ali-lab/context/LabLanguageContext.tsx`, `client/src/ali-lab/i18n/labStrings.ts` | `en` \| `fr` \| `de` \| `it` | **Only** components under `/ali` that call `useLabLanguage()` |

**`de` = German (Deutsch, Switzerland `de-CH`), NOT Dutch (`nl`).** UI buttons show `DE` with title “Deutsch (German)”. Never put Dutch (Nederlands) copy under the `de` locale.
| **Coverage helper** | `client/src/ali-lab/i18n/labCoverage.ts` | — | Compares lab keys vs English fallback |

**Storage:** `localStorage` key `paystack_language` — values `en` or `fr`. First visit defaults to **French** unless the user previously chose English.

**API:** `const { language, setLanguage, t } = useLanguage()` — `t('someKey')` returns the string for the active language; missing keys echo the key name (visible bug).

**Ali lab is isolated:** `/ali` wraps content in `LabLanguageProvider` (`AliLabShell.tsx`). It does **not** read `useLanguage()` from the global provider. The DE/IT switcher lives only in `DeItPanel.tsx`; the rest of the lab UI stays English unless migrated.

---

## Known root causes (2026-05)

### 1. `/app` — English hard-coded in UI logic

`RestaurantDashboard.tsx` (and related café components) still contain user-visible English in:

- `alert()`, `confirm()` dialogs (delete session, master reset, drop errors, convert income/expense, document save failures)
- `aria-label` (e.g. `"Navigation principale"` while UI language is EN — mixed locale)
- Inline labels (`To pay (received - paid)`, `Gross Sales (CHF)`, VAT helper text)
- Category labels in `DocumentProcessor.tsx` (`RESTAURANT_CATEGORIES` — English `label` strings)
- Console-only strings may stay English; **do not** leave user-facing alerts in one language

**Fix pattern:** Add keys to **both** `translations.en` and `translations.fr` in `LanguageContext.tsx`, then replace literals with `t('key')`.

### 2. Landing `/` — French or English leaking

Most sections use `t()` correctly (`Navbar`, `HeroSection`, `ModulesSection`, etc.). Remaining issues are usually:

- **Keys with wrong language in one locale** (e.g. English text under `fr:` or French under `en:`) — audit by toggling EN/FR on each section
- **Data not wired to `t()`** — e.g. `PlatformTourSection` / `FeaturesSection` arrays built once without `language` in `useMemo` deps (stale copy after switch)
- **SEO** — `SeoHead.tsx` is intentionally split (`SEO_EN` / `SEO_FR`); add routes when new public pages ship (`/ali-gate` is noindex; lab excluded)

Default site language is **French**; English users expect **zero** French fragments when `language === 'en'`.

### 3. `/ali` — language switch “does not work”

This is expected with the current design unless you fix it:

| Problem | Why |
|---------|-----|
| Navbar on `/` changes language; `/ali` does not follow | Lab uses `LabLanguageProvider`, not `LanguageProvider` state |
| DE/IT/FR buttons only in **German & Italian** feature | `setLang` in `DeItPanel.tsx` does not affect other feature routes |
| Shell always English | `AliLabPage.tsx`, `featureRegistry.ts`, promotion checklist, `AliLabAuthBanner`, Firebase banner |
| Panels partially translated | Many strings still literal (`Loading ledger…`, `Total`, `Week`, `Batch test…`, `feature.summary` from registry) |
| `labStrings.ts` incomplete | `fr` spreads `en` then overrides ~30 keys; `de`/`it` idem — coverage table shows gaps |

**Fix direction (choose one; prefer A for consistency):**

- **A (recommended):** Sync lab with global language: in `AliLabShell`, read `useLanguage()` and map `en`/`fr` into lab panels; add optional DE/IT only in `de-it-i18n` feature or when promoting to `LanguageContext`.
- **B:** Keep separate lab locale but add a **lab-wide** switcher in `AliLabShell` / sidebar (all four langs), persist `paystack_ali_language` in `localStorage`, and replace **every** user-visible string in `client/src/ali-lab/**` with `labT` / `t` from `useLabLanguage()`.

Extend `labStrings.ts` (or add `labRegistryStrings`) for registry titles, statuses, shell chrome, and panel-specific copy.

---

## Agent instructions (copy-paste)

```
You are fixing i18n across Paystack.ch: landing (/), dashboard (/app), and Ali lab (/ali).

Rules:
1. Production UI (landing + /app + auth): use useLanguage() and keys in client/src/cafe/context/LanguageContext.tsx — BOTH en and fr for every new key.
2. Never ship a key in only one language — en and fr blocks must stay in sync (613+ keys today).
3. User-visible strings must not be hard-coded in JSX, alerts, confirms, aria-label, title, or placeholder attributes.
3b. **CHF amounts:** use `useFormatChf()` or `formatChfAmount()` from `LanguageContext.tsx` — never bare `chfLocale` unless `useChfLocale()` is in the **same** React component. Run `node scripts/check-chf-locale.mjs` after dashboard money UI edits.
4. Ali lab (/ali): either sync with global LanguageContext (en/fr) OR use useLabLanguage() + labStrings.ts for all visible text including AliLabPage shell and featureRegistry labels.
5. Do NOT promote Ali features to /app as part of this task unless the user explicitly asked.
6. DE/IT: complete in lab (labStrings.ts) first; `de` must be proper **German**, never Dutch; add de|it to LanguageContext only when user asks for production DE/IT.
7. Run pnpm build after substantive changes. Manually test: toggle EN/FR on /, /app, and /ali (each feature route).

Workflow per surface:
LANDING: Open http://localhost:3000/ — toggle language in Navbar — walk every section (#features … #contact). Fix stale memo deps and wrong-locale keys.
APP: Sign in → /app — toggle language in dashboard header — check tabs, modals, document processor, POS, billing, alerts.
ALI: Open /ali/budgeting (after gate) — verify switcher updates ALL visible text on that route; repeat budgeting, bill-reminders, goals, forecasting, automation-rules, shared-access, offline, investments, de-it-i18n.

When adding keys:
- Use camelCase semantic names: documentDeleteFailed, navMainAria, labLoadingLedger
- Keep CHF, TVA, Swiss product terms consistent with existing glossary in LanguageContext
- Prefer reusing existing keys over duplicates (grep translations.en for similar strings)

Out of scope unless requested:
- Translating console.log / dev-only messages
- Bank-sync / Open Banking copy
- Professional human review of DE/IT (agent fills structurally correct German/Italian)
```

---

## File map

| Area | Primary files |
|------|----------------|
| Translation source (prod) | `client/src/cafe/context/LanguageContext.tsx` |
| Language switch (marketing) | `client/src/components/Navbar.tsx` |
| Language switch (app) | `client/src/cafe/components/RestaurantDashboard.tsx` |
| SEO | `client/src/components/SeoHead.tsx` |
| Landing sections | `client/src/components/*Section.tsx`, `Footer.tsx` |
| Dashboard | `client/src/cafe/components/RestaurantDashboard.tsx`, `DocumentProcessor.tsx`, `POSManager.tsx`, `BillingPlanPanel.tsx`, … |
| Ali shell | `client/src/pages/AliLabPage.tsx`, `client/src/ali-lab/AliLabShell.tsx` |
| Ali strings | `client/src/ali-lab/i18n/labStrings.ts`, `labCoverage.ts` |
| Ali panels | `client/src/ali-lab/features/*.tsx`, `components/LabLedgerSnapshot.tsx` |
| Feature metadata | `client/src/ali-lab/featureRegistry.ts` |

---

## Audit commands

From repo root (PowerShell):

```powershell
# User-visible English in ali-lab (review each hit)
rg -n "Loading |Sign in|Total|Week|Add |Delete |Error|Please |Could not" client/src/ali-lab --glob "*.tsx"

# alert/confirm in dashboard (must become t())
rg -n "alert\(|confirm\(" client/src/cafe/components --glob "*.tsx"

# aria-label without t(
rg -n 'aria-label="' client/src --glob "*.tsx"

# French in TSX outside LanguageContext / SeoHead (likely stray)
rg -n "[àâäéèêëïîôùûüç]" client/src --glob "*.tsx" -g "!**/LanguageContext.tsx" -g "!**/SeoHead.tsx"

# Key parity en vs fr
node scripts/i18n-key-parity.mjs
```

---

## Acceptance checklist

### Landing `/`

- [ ] Navbar EN/FR toggle updates **all** sections without reload
- [ ] No French visible when language is EN (and vice versa for FR default)
- [ ] `document.documentElement.lang` matches (`en` / `fr`)
- [ ] SEO title/description switches per `SeoHead` + language

### Dashboard `/app`

- [ ] Header language toggle updates tabs, sidebar, modals, empty states
- [ ] All `alert` / `confirm` strings use `t()`
- [ ] `aria-label` and `title` attributes localized
- [ ] Document categories / POS labels use `t()` or mapped keys (not raw English enums in UI)

### Ali lab `/ali`

- [ ] Language control visible on **every** feature route (sidebar or shell), not only `de-it-i18n`
- [ ] Switching `fr` / `de` / `it` / `en` updates shell + active panel copy
- [ ] `featureRegistry` titles/summaries localized or keyed
- [ ] `labTranslationCoverage` ≥ 95% for `fr`, `de`, `it` before claiming “ready”

### Build

- [ ] `pnpm build` succeeds
- [ ] No new secrets in client env

---

## Priority order (recommended)

1. **Sync or unify Ali lab language** with global EN/FR (fixes “switch does nothing” perception)
2. **`/app` alerts and aria-labels** — highest user pain, English-only
3. **Landing stale `useMemo`** and wrong-locale keys — toggle testing
4. **Ali panel string sweep** — extend `labStrings.ts`, wire `featureRegistry`
5. **DE/IT lab completeness** — then optional merge into `LanguageContext` (see `docs/ALI_LAB_SUPER_PROMPT.md` Feature 7)

---

## Promotion note (Ali → `/app`)

When lab i18n is merged into production, follow `docs/ALI_LAB_SUPER_PROMPT.md` promotion checklist: add keys to `LanguageContext.tsx`, do **not** leave duplicate `labStrings` for the same UI after promotion.

---

## Environment

No extra env vars for i18n. Test locally:

```bash
pnpm dev
# Landing: http://localhost:3000/
# App:      http://localhost:3000/app (Firebase auth)
# Ali:      http://localhost:3000/ali-gate → /ali/budgeting
```

---

## Related docs

- `docs/ALI_LAB_SUPER_PROMPT.md` — feature lab scope and promotion gate
- `AGENTS.md` — repo commands and `/ali` access
