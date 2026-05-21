# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Paystack.ch is a Swiss restaurant/hospitality financial management SaaS (React 19 + Vite + TypeScript). It uses Firebase (Auth, Firestore, Storage) as its backend and integrates with Google Gemini AI for document processing and Stripe for subscription billing.

### Running services

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| Vite Dev Server (SPA) | `pnpm dev` | 3000 | Primary dev entry point; serves the full React app |
| Stripe Dev Server | `pnpm dev:stripe-server` | 8787 | Optional; only needed when testing Stripe checkout/Gemini proxy locally. Requires `STRIPE_DEV_PROXY=1` in `.env` |

### Key commands

- **Dev server:** `pnpm dev` (Vite on port 3000, hot-reload enabled)
- **Type check:** `pnpm check` (runs `tsc --noEmit`; note: codebase has pre-existing TS errors)
- **Format:** `pnpm format` (Prettier write) / `pnpm exec prettier --check .` (check only)
- **Build:** `pnpm build` (Vite frontend + esbuild server bundle into `dist/`)
- **Tests:** `pnpm exec vitest run` (Vitest is configured but no test files currently exist)

### Environment setup

- Copy `.env.example` to `.env`. Firebase credentials (`VITE_FIREBASE_*`) are required for auth/data features to work. Without them the marketing/landing pages still render.
- `GEMINI_API_KEY` is needed for AI document processing.
- Stripe keys are optional; subscription enforcement can be disabled with `VITE_SUBSCRIPTION_ENABLED=false`.

### Caveats

- The `pnpm install` will warn about ignored build scripts on first install. The `onlyBuiltDependencies` field in `package.json` allows these; run `pnpm rebuild` if native modules (sharp, esbuild, @tailwindcss/oxide) are missing after install.
- The TypeScript check (`pnpm check`) has pre-existing errors in the codebase. These are not regressions from environment setup.
- Prettier reports pre-existing formatting issues in ~119 files. This is the baseline state.
- The app uses `wouter` for routing (not react-router). A patched version is used via `patches/wouter@3.7.1.patch`.
- Vite config includes a storage proxy and debug collector plugin (for Manus integration); these are safe to ignore in local dev.

### Ali feature lab (`/ali`)

Password-gated sandbox for the **10 competitor-gap features** (budgeting, bank sync, goals, etc.). Production app stays at `/app` until features are promoted.

- **URLs:** `/ali-gate` (login), `/ali` and `/ali/<feature-id>` (lab)
- **Password:** `ALI_LAB_PASSWORD` in `.env` (see `.env.example`; default `ali123*`)
- **Super prompt:** `docs/ALI_LAB_SUPER_PROMPT.md`
- **Registry:** `client/src/ali-lab/featureRegistry.ts`
- **Local API:** run `pnpm dev:stripe-server` so Vite can proxy `POST /api/ali/verify`; otherwise use `VITE_ALI_LAB_PASSWORD` dev fallback after gate
