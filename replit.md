# Chainsaw Manual Professional Training App

A £198 high-ticket vocational chainsaw safety certification platform with sequential video learning, interactive assessments, device-locked access, and an admin dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/chainsaw-training run dev` — run the training app frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Optional env: `ADMIN_PASSWORD` — Admin panel password (default: `chainsaw-admin-2024`)
- Optional env: `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY` — for AI chat (falls back to keyword-based responses)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, Wouter router, TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Video: `@vimeo/player` SDK
- Signature: `signature_pad`

## Where things live

- DB schema: `lib/db/src/schema/` (users.ts + modules.ts)
- API contract: `lib/api-spec/openapi.yaml`
- API routes: `artifacts/api-server/src/routes/` (auth, modules, progress, quizzes, waiver, ai, admin)
- Frontend pages: `artifacts/chainsaw-training/src/pages/`
- Frontend contexts: `artifacts/chainsaw-training/src/contexts/` (UserContext, AdminContext)
- Frontend components: `artifacts/chainsaw-training/src/components/` (VimeoPlayer, SignaturePad)

## Architecture decisions

- **Triple-lock security**: Activation codes from DB bond atomically to first device ID encountered. Admin can reset bonds. Dynamic watermark (name + email) overlays all video, repositions every 60s.
- **Sequential locking**: Each module unlocks only after the previous module's video is watched AND quiz is passed (80% threshold).
- **Heartbeat progress**: 30-second intervals save video timestamps to DB via the `/api/progress/heartbeat` endpoint.
- **Device ID**: Generated once in the browser using `uuid` and stored in localStorage. Sent as a request header on all authenticated calls.
- **Admin auth**: Token-based (in-memory set, 24h TTL), password configurable via `ADMIN_PASSWORD` env var.
- **AI mock test**: Uses OpenAI (via Replit AI Integrations if enabled) with a system prompt restricting answers to chainsaw safety topics. Falls back to keyword-based responses if AI is not available.

## Product

- Students activate via a Shopify purchase code bonded to their device
- Digital waiver with touch/mouse signature (mandatory on first launch)
- 7 sequential training modules with Vimeo video streaming
- Per-module quizzes (80% to pass, unlimited retries)
- AI "Chainsaw Manual Examiner" mock assessment (chainsaw-topics only)
- Standalone Inspection Checklist (`/inspection`) — pre-start/pre-use safety checks, personal record only, not tied to module progress
- Standalone Dynamic Risk Assessment (`/risk-assessment`) — GPS-derived site location (address + OS National Grid reference), task description, and an editable common-hazards checklist (kickback, manual handling, trips, rolling timber, lone working, etc.) with likelihood x severity risk rating
- Admin dashboard: student progress, waiver PDFs, device bond resets, activation code management, inspection/risk-assessment review

## Demo credentials

- Activation code: `DEMO-CHAIN-2024` (unused, test with any name/email)
- Admin password: `chainsaw-admin-2024`

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Vimeo `vimeoId` in the DB uses `76979871` as a placeholder — replace with real Vimeo video IDs once uploaded.
- `@import url()` for Google Fonts MUST be the first line in `index.css` (before Tailwind) to avoid PostCSS parse errors.
- Admin tokens are in-memory; restarting the API server invalidates all admin sessions.
- The AI chat falls back gracefully when `AI_INTEGRATIONS_OPENAI_*` env vars are not set.
- Risk assessment location lookup uses free OpenStreetMap Nominatim reverse geocoding (no API key) — fine for low volume, but not for production-scale traffic.
- Nearest hospital/A&E and nearest AED lookups were deliberately NOT built: there is no reliable free/public API for either (UK's official AED registry "The Circuit" is restricted to ambulance services; A&E phone numbers need a static NHS ODS dataset, not a live API). Revisit only with a proper data source.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
