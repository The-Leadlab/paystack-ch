# Operator voice notes — Q2 2026 master Super Prompt

Use when implementing stakeholder feedback from live demos, accountant onboarding (Glanville), Catholic Group concurrency, billing roadmap, and liability/storage policy.

Related: `docs/DOCUMENT_BATCH_I18N_ERRORS_SUPER_PROMPT.md`, `docs/TEAM_INVITE_SUPER_PROMPT.md`, `docs/STRIPE_CHECKOUT_SUPER_PROMPT.md`, `docs/PERSONAL_E2E_DRIVE_SUPER_PROMPT.md`, `docs/ADMIN_BULK_BILLING_SUPER_PROMPT.md`, `docs/BATCH_PROCESSING_DEMO_UX_SUPER_PROMPT.md`, `docs/SINGLE_ACTIVE_SESSION_SUPER_PROMPT.md`, `docs/ANNUAL_BILLING_SUPER_PROMPT.md`, `docs/STORAGE_LIABILITY_DRIVE_SUPER_PROMPT.md`, `docs/BETA_USAGE_ANALYTICS_SUPER_PROMPT.md`, `docs/TEAM_ROLES_PHASE3_SUPER_PROMPT.md`.

---

## Themes (from voice)

| Theme | Urgency | Doc |
|-------|---------|-----|
| Demo queue looks broken (spinners, nothing finishes) | **Now** | `BATCH_PROCESSING_DEMO_UX_SUPER_PROMPT.md` |
| One login / two browsers (Catholic Group) | **Now** | `SINGLE_ACTIVE_SESSION_SUPER_PROMPT.md` |
| Beta / accountant usage truth (logins, docs, errors) | **High** | `BETA_USAGE_ANALYTICS_SUPER_PROMPT.md` |
| Monthly ↔ annual pricing toggle + future price rises | **June** | `ANNUAL_BILLING_SUPER_PROMPT.md` |
| Unlimited upgrade path + CHF 500 → higher later | **June** | `ANNUAL_BILLING_SUPER_PROMPT.md` |
| Liability: no long-term custody; Drive + local | **High** | `STORAGE_LIABILITY_DRIVE_SUPER_PROMPT.md` |
| Drive **and** local download option | **High** | `STORAGE_LIABILITY_DRIVE_SUPER_PROMPT.md` |
| Team roles: owner / manager / member + permissions | **Later** | `TEAM_ROLES_PHASE3_SUPER_PROMPT.md` |
| Raise proxy Gemini rate limit (30/10min) | **When batching** | `GEMINI_FAILED_TO_FETCH_SUPER_PROMPT.md` |

---

## Product decisions (confirm with operator)

1. **Annual billing** — Stripe yearly Price IDs exist? Target discount (e.g. 2 months free)? Show toggle on landing + `/app` billing only, or checkout too?
2. **Single session** — Hard kick on second login immediately, or 30s warning? Apply to **shared credential** accounts only, or every uid?
3. **Stale `processing`** — Auto-reset rows stuck >20 min to `pending`, or admin-only “Reset stuck”?
4. **Usage analytics** — Admin-only vs accountant self-serve portal? Retention (90d events)?
5. **Glanville firms** — One Paystack workspace per client restaurant, or one umbrella org with many sites?

---

## Phased build plan

### Phase A — Demo credibility (1–2 days)

- [ ] Queue UX: only **active** pool workers show spinner; others show **Queued**
- [ ] Banner: `N active · M queued · X/Y done`
- [ ] Recover Firestore rows stuck in `processing` (stale timeout → `pending`)
- [ ] `GEMINI_RATE_LIMIT_MAX` default raised for real batches (env on Vercel)
- [ ] Single active browser session per Firebase uid (see `SINGLE_ACTIVE_SESSION_SUPER_PROMPT.md`)

### Phase B — Operator control (1 week)

- [ ] `userActivity` events: login, logout, session heartbeat, doc_upload, doc_error
- [ ] Admin user detail: login count, last login, session minutes (7d/30d), docs uploaded, error count
- [ ] Filter/tag beta testers + accountant emails (Glanville list)
- [ ] Export CSV for “is this feedback bullshit?” audits

### Phase C — Storage & legal (1 week, legal review)

- [ ] Settings: **Storage** — Firebase only for AI pass / Drive mirror / **both**
- [ ] Connect Drive consent copy + Terms: no liability for data loss; user owns files
- [ ] Optional: auto-download processed PDF to browser after AI
- [ ] Retention job: delete Storage blobs after N days if Drive connected (configurable)

### Phase D — Billing June

- [ ] Monthly | Annual toggle on pricing + checkout
- [ ] Stripe yearly prices; portal upgrade to Unlimited campaign
- [ ] Price increase comms template (notice period)

### Phase E — Team roles (later)

- [ ] Roles: `owner` | `manager` | `member` | `accountant` (read-heavy)
- [ ] Permissions matrix (upload, billing, invites, reports)
- [ ] Budget module hook (existing lab → product)

---

## Agent instructions (copy-paste)

```
Apply docs/OPERATOR_VOICE_Q2_2026_SUPER_PROMPT.md and linked child prompts.

Priority order: Phase A → B → C. Do not ship Phase D until Stripe yearly prices exist.
Do not promote Ali lab features to /app without explicit chat approval.
Document concurrent-upload limits in SINGLE_ACTIVE_SESSION_SUPER_PROMPT.md.
Do not push/commit unless asked.
```

---

## Catholic Group / concurrent upload (answer for demos)

| Scenario | Today | After Phase A |
|----------|-------|----------------|
| Same email/password, two browsers | Both stay signed in; uploads can race on same `restaurantId` | Second login kicks first (single active session) |
| Team invites (different uids, same workspace) | Supported; `dataOwnerUid` scopes data | No kick; different auth users |
| Two uploads same account same hour | Firestore + queue races possible | One session → one uploader at a time |

Until concurrent upload is tested and hardened, **single active session** is the safe protocol for shared credentials.

---

## Prevention

- Never show `processing` spinner without an active worker id in the pool.
- Never leave Firestore `processing` without heartbeat / stale recovery.
- Never trust beta feedback without `lastSignInAt` + `docsThisMonth` + `errorsThisWeek` in admin.
- Price/marketing copy must match Stripe Price interval (month vs year).
