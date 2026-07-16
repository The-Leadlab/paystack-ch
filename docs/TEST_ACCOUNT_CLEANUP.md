# Test account cleanup (dress rehearsal)

## Policy

Delete Firebase Auth users (and `users/{uid}` billing docs) that are **test-mode** and **not** on the key-staff allowlist.

Default allowlist (confirm before running):

- `ali@the-leadlab.com`
- `william@the-leadlab.com`
- `joshua@the-leadlab.com`
- `kara@the-leadlab.com`

## What counts as test mode

A user is a cleanup candidate if **any** of:

1. Firestore `users/{uid}.planTestMode === true`
2. Stripe customer exists only in **test** mode (no live `stripeCustomerId` / resolved via test keys)
3. Account was created for weekend sandboxes with no saved live customer ID

## How to clean up (safe path)

Use the existing admin console (`/admin` → Users):

1. Search for weekend / sandbox emails.
2. Open each non-allowlist user.
3. Prefer **Disable** first if unsure.
4. Use **Delete user** for confirmed test accounts (`delete_user` action already removes Auth + billing doc).

Do **not** bulk-delete from production without confirming the allowlist in chat.

## Optional API later

If bulk cleanup is needed, add `POST /api/admin/cleanup-test-users` with `{ dryRun: true, allowlist: string[] }` gated by admin session. Not required for dress rehearsal if manual admin deletes suffice.
