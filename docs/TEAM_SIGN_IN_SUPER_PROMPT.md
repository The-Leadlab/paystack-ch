# Team / admin sign-in — Super Prompt

Operator and admin tools use `/operator` (password gate) then `/admin`. Customer auth stays separate but staff can reach the gate from sign-in / sign-up.

---

## Policy

| Surface | Admin entry |
|---------|-------------|
| `/sign-in`, `/sign-up` | **Top-right pill** → `/operator?next=%2Fadmin` (`navSignInExisting`) + **EN/FR toggle** |
| Landing nav, pricing CTAs | No admin link — customer “Sign in” only |
| `/operator` | Password gate + language toggle → `/admin` |
| `/admin` | Dashboard + language toggle in header |

All auth and admin shells use `LanguageContext` (`t(...)`) — default French, toggle to English via header button.

---

## Entry URLs (bookmark these)

| URL | Purpose |
|-----|---------|
| `/operator` | Operator password gate (`ADMIN_GATE_PASSWORD` / `POST /api/admin/verify`) |
| `/admin` | Admin dashboard (redirects to `/operator` if gate cookie missing) |

`robots.txt` disallows both paths. SEO uses `SeoNoIndex` on gate and admin pages.

---

## Do not add

- Large footer “Team sign in” buttons on auth cards
- Admin links on marketing navbar or pricing CTAs

---

## Code map

| Piece | Path |
|-------|------|
| Auth shell + admin pill + language | `client/src/pages/auth/AuthLayout.tsx` |
| Language toggle | `client/src/components/LanguageToggleButton.tsx` |
| Admin panel header | `client/src/pages/admin/AdminLayout.tsx` |
| Operator password gate | `client/src/pages/OperatorGatePage.tsx` |
| Admin dashboard | `client/src/pages/AdminDashboardPage.tsx` |

---

## Mobile (phones)

| Area | Behavior |
|------|----------|
| Language toggle | Globe icon + **EN** / **FR** target code, 44px touch height |
| Admin header | Two-row layout: actions top, title below; home as icon + short label |
| User list | Card list on `< md`; table on desktop |
| Tabs (Users / Operator) | 2-column grid on phone, full-width lock button |
| User detail tabs | 2×2 grid on phone |

---

## QA

- [ ] `/sign-in` and `/sign-up` — admin pill top-right; EN/FR toggle works
- [ ] `/operator` — language toggle; gate → `/admin`
- [ ] `/admin` on phone — language toggle readable; user cards tappable; tabs usable
- [ ] Landing navbar — no admin link
