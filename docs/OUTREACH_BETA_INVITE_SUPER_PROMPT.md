# Outreach email — phone white borders + laptop/phone behavior

## Goal

Same email on **laptop Gmail** and **phone Gmail (dark mode)**:

| Surface | Heroes / GIF | Letter text | Side gutters |
|---------|--------------|-------------|--------------|
| Laptop | Black images (always) | White on black cells | Fine (Gmail web chrome) |
| Phone dark | **Same** black images | White on black cells | **Must not be white strips** |

Do **not** ship a light hero for phone. Images never swap by theme.

## Why two “versions” are one HTML file

Make.com sends **one** HTML body per email. We do **not** maintain separate Make scenarios for phone vs laptop.

Instead, one file (`docs/outreach/paystack-beta-invite.html`) encodes both behaviors:

1. **Content (laptop + phone):** black tables/cells + black `/outreach/*-v2.jpg` / `upload-demo-v7.gif` + white `#FFFFFF` text.
2. **Phone gutters:** `html`/`body` use `background-color: transparent` so Gmail iOS dark mode fills the side frame with the **app’s black chrome** instead of forcing a white/grey reading-pane border.
3. **Phone width:** `@media (max-width: 620px)` forces `.outer-table` / `.inner-table` / images to `width:100%` so the black column fills the message pane.

Painting `body` solid `#0c0c0c` (or `color-scheme: light only`) was what produced the thick **white vertical borders** around an otherwise correct black letter.

## Hard rules

1. Body / html → **transparent** (no solid body fill).
2. All letter/CTA/footer cells → `bgcolor="#0c0c0c"` + `background="…/email-bg-black.png"` (or linear-gradient lock).
3. Heroes + GIF → black assets only; no `-light` srcs; no CSS image swap.
4. Text → `#FFFFFF` / muted `#B0B0B0` with `.txt` `!important`.
5. Outer padding → `0` (no `24px 12px` gutters in our HTML).
6. Never reintroduce cream / `#FFF5F4` / light shells.
7. After any HTML edit: copy to `C:\Users\attia\Downloads\paystack-beta-invite-campaign.html`, **full replace** in Make, send a **new** test (old messages keep old chrome).

## Source of truth

| Asset | Path |
|-------|------|
| HTML | `docs/outreach/paystack-beta-invite.html` |
| Make paste | `C:\Users\attia\Downloads\paystack-beta-invite-campaign.html` |
| This prompt | `docs/OUTREACH_BETA_INVITE_SUPER_PROMPT.md` |
| Heroes | `https://www.paystack.ch/outreach/paystack-beta-hero-fr-v2.jpg` / `…-en-v2.jpg` |
| GIF | `https://www.paystack.ch/outreach/upload-demo-v7.gif` |
| Cell tile | `https://www.paystack.ch/outreach/email-bg-black.png` |
| Calendar | `https://calendar.app.google/gjusbBhAfBKaEh1J6` |
| From | `Lucas \| Paystack <lucas@paystack.ch>` |
| Merge | `{{11.`3`}}` |

## Agent checklist

- [ ] Body is `transparent` (not `#0c0c0c`)
- [ ] Grep HTML: no `light only` as the only scheme; prefer `light dark`
- [ ] Grep: zero `-light.` image URLs, zero `FFF5F4`
- [ ] Phone dark: no white side strips; black heroes; white letter text
- [ ] Laptop: black block still looks like the reference screenshot
- [ ] Downloads paste refreshed; Make fully replaced; new send only

## If white borders return

1. Confirm the test is a **new** send with the transparent-body HTML.
2. Do **not** “fix” by painting body black again — that recreates the white frame on Gmail iOS.
3. If Gmail still frames the message after transparent body, document client limitation; last-resort nuclear option is a single full-bleed tall image for the letter (loses selectable text / merge personalization in that block). Prefer keeping HTML text + transparent body first.
