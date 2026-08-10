# Firebase Auth assertion + ticket PDF hang — Super Prompt

## Symptoms (production)

While processing **Ticket fevrier .pdf**:

1. UI stuck on **EN COURS** / Processing
2. Console shows only `Processing: Ticket fevrier .pdf` (no page-split logs)
3. Then:
   ```
   @firebase/auth: INTERNAL ASSERTION FAILED: Pending promise was never set
   Uncaught (in promise) Error: INTERNAL ASSERTION FAILED: Pending promise was never set
     at … onAuthEvent / reject (abstract_popup_redirect_operation)
   ```

## Two separate problems

### A. Auth assertion (noise that must not break the session)

Firebase Auth’s **popup/redirect event manager** receives an auth iframe event with **no matching pending popup promise**. Common after Google `signInWithPopup`, multi-tab, or stale `/__/auth` iframe messages. It is **not** a Storage/Gemini failure by itself, but an **uncaught rejection** can unsettle the page and scare operators.

**Fix (defense in depth):**

1. `initializeAuth` with explicit persistence + `browserPopupRedirectResolver`
2. Await / fire-and-handle `getRedirectResult(auth)` on startup (consume leftover redirect)
3. Global `unhandledrejection` filter: `preventDefault` only when message is exactly this assertion
4. Wrap `signInWithPopup` so leftover reject paths are caught
5. Do **not** remove popup login UX; do **not** sign users out when this fires

### B. Ticket PDF stuck EN COURS (real functional bug)

Multi-page ticket PDFs need **pdf.js**. If the **worker script 404s or never loads**, `getDocument()` hangs → processDoc never reaches `🧾 PDF page-split` → forever **EN COURS**.

Vite pitfall: `new URL('pdfjs-dist/build/…', import.meta.url)` is **not** rewritten in production.

**Fix (reliable worker + fail-safe):**

1. Ship worker as a static asset: `client/public/pdf.worker.min.mjs` → `/pdf.worker.min.mjs`
2. Keep `?url` import as secondary candidate
3. Hard timeouts on `getDocument` / rasterize (already) → fall back to full-PDF analysis instead of hanging
4. Step logs in `processDoc`: `file→cache→storage→pdf-peek→analyze` so stalls are diagnosable
5. Outer watchdog: if no progress, surface **error** status (never silent forever)

## Acceptance

- [ ] Ticket fevrier either completes page-split **or** fails with a visible error within ~2 minutes (never infinite EN COURS)
- [ ] Console shows step logs through pdf-peek / page-split
- [ ] Auth assertion either gone or suppressed (no uncaught rejection); session stays signed in
- [ ] Google sign-in popup still works
- [ ] Payslips / single-page docs unchanged

## Out of scope

- Replacing Firebase Auth
- Server-side Poppler
- Open Banking
