# Personal / Ali-lab cloud sync fix — Super Prompt

## Bug

Budget (and other Ali-lab persist panels) show a hard **Cloud sync failed** badge when Firestore `ali_lab_*` load/write fails (often permission-denied if rules lag or query fails). LocalStorage already keeps data.

## Required

1. Soft-fail cloud: on load/write permission errors, keep local data; set `cloudAvailable: false` / soft `syncError`.
2. UX: never alarm with red “Cloud sync failed” when local data is fine — show quiet “Saved on this device” (dismissible) or hide after load-only soft fail.
3. Ensure writes always include `restaurantId = dataOwnerUid`; updates merge `restaurantId`.
4. Optional one retry after auth token refresh on permission-denied.

## Isolation

Do not route personal/ali-lab data into business Revenue.
