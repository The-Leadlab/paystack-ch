# Team / admin sign-in — Super Prompt

Team and operator access must **not** be advertised on public customer auth pages. Staff reach admin tools only via direct URLs.

---

## Policy

| Surface | Team sign-in |
|---------|----------------|
| `/sign-in`, `/sign-up`, landing nav, pricing CTAs | **Hidden** — no link to `/operator` or `/admin` |
| `/operator` | Password gate → redirects to `/admin` (or `?next=`) |
| `/admin` | Firebase sign-in for bypass emails + admin dashboard |

Public `/sign-in` is for **restaurant customers** only (existing accounts / post-checkout linking).

---

## Entry URLs (bookmark these)

| URL | Purpose |
|-----|---------|
| `/operator` | Operator password gate (`ADMIN_GATE_PASSWORD` / `POST /api/admin/verify`) |
| `/admin` | Admin dashboard (redirects to `/operator` if gate cookie missing) |

`robots.txt` disallows both paths. SEO uses `SeoNoIndex` on gate and admin pages.

---

## Do not add

- “Team sign in”, “Admin login”, or `/operator` links on `/sign-in`, `/sign-up`, `Navbar`, or marketing sections
- Public nav items using `navSignInExisting` or `authTeamSignIn` toward operator routes

---

## Code map

| Piece | Path |
|-------|------|
| Customer sign-in (no team link) | `client/src/pages/SignInPage.tsx` |
| Operator password gate | `client/src/pages/OperatorGatePage.tsx` |
| Admin dashboard + bypass sign-in | `client/src/pages/AdminDashboardPage.tsx` |
| Gate API | `api/admin/verify`, `api/admin/logout`, `api/admin/session` |
| Middleware | `middleware.ts` (admin cookie on `/admin`, `/api/admin/*`) |

Legacy `AdminSignInPage.tsx` redirects to `/operator`; route is not mounted in `App.tsx`.

---

## QA

- [ ] `/sign-in` — no “Team sign in” button or `/operator` link
- [ ] Landing navbar — only customer “Sign in” → `/sign-in?redirect=%2Fapp`
- [ ] `/operator` — gate works; success lands on `/admin`
- [ ] `/admin` without cookie — redirect to `/operator`
- [ ] Bypass email can sign in on `/admin` Operator tab after gate
