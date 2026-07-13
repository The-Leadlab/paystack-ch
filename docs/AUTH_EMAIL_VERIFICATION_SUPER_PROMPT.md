# Auth email verification — Super Prompt

Fixes the bare Firebase page (`paystack-ch.firebaseapp.com`) with no button after email verification.

---

## Symptom

- User clicks **Verify email** in inbox
- Lands on Firebase default: “Your email has been verified” — **no CTA**
- Stuck on `firebaseapp.com`, not `paystack.ch`

---

## Root cause

`sendEmailVerification()` was called **without** `ActionCodeSettings`, so Firebase used its default hosted page.

---

## Code (this repo)

| Piece | Path |
|-------|------|
| Action handler page | `client/src/pages/AuthActionPage.tsx` → `/auth/action` |
| Continue URL helper | `client/src/cafe/lib/firebaseEmailAction.ts` |
| Send verification | `client/src/cafe/context/AuthContext.tsx` |
| Pre-verify gate | `client/src/cafe/components/EmailVerificationGate.tsx` |

Verification emails now use:

- `url`: `https://www.paystack.ch/auth/action` (or current origin in dev)
- `handleCodeInApp: true`

After success the user sees **Continue to sign in** and **Back to homepage**.

Links that still open `firebaseapp.com` are **redirected** to `www.paystack.ch/auth/action?...`.

---

## Firebase Console checklist

1. **Authentication → Settings → Authorized domains**
   - `paystack.ch`
   - `www.paystack.ch`
   - `localhost` (dev)

2. **Authentication → Templates → Email address verification**
   - Optional: customize template text
   - Action URL is overridden by `ActionCodeSettings` in code

3. Resend verification from the app (EmailVerificationGate) so new links use `/auth/action`.

---

## QA

- [ ] Sign up with email/password → receive verification email
- [ ] Link opens `paystack.ch/auth/action` (not bare firebaseapp.com)
- [ ] Success screen shows **Continue to sign in** + **Back to homepage**
- [ ] After sign-in → subscription gate → Stripe live checkout works

See also: `docs/STRIPE_CHECKOUT_SUPER_PROMPT.md`
