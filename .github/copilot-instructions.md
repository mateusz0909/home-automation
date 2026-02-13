# Copilot instructions for gcp-automation

## Big picture
- This repo has two deployable parts:
  - `src/*`: a single Google Cloud Function (`curtainAutomation`) implemented with `@google-cloud/functions-framework`.
  - `frontend/src/*`: a Next.js 15 dashboard that authenticates users and proxies requests to the Cloud Function.
- Core flow: Cloud Scheduler (or dashboard/manual call) -> Cloud Function route in `src/index.ts` -> Tuya Cloud API via `src/tuya-client.ts` -> config/log persistence in Firestore via `src/config.ts`.

## Service boundaries and routes
- Backend API surface is centralized in `src/index.ts`:
  - `POST /` and `POST /trigger` run gradual automation (`src/automation.ts`).
  - `POST /command` sends immediate `open|close|stop`.
  - `GET /status`, `GET/PUT /config`, `GET/PUT /schedule`, `GET /logs`.
- Frontend must call internal Next.js API routes (`frontend/src/app/api/curtain/*`) rather than calling GCP directly from client components.
- API route pattern in frontend:
  1. check `isAuthenticated()` from `frontend/src/lib/auth.ts`
  2. call `gcpFetch()` from `frontend/src/lib/gcp.ts`
  3. parse with `gcpJsonResponse()` and forward status/body.

## Project-specific conventions
- Keep backend route handling in one function file (`src/index.ts`) with early returns per route.
- Reuse `ConfigService` for all Firestore access; config document is `curtain-automation/config`, logs are subcollection `execution-logs`.
- Reuse `SchedulerService` (`src/scheduler.ts`) when changing schedule behavior; `/schedule` updates Firestore + Cloud Scheduler together.
- Preserve retry behavior in `frontend/src/lib/gcp.ts` (retries 429/5xx with backoff) and non-JSON fallback handling.
- Auth is intentionally lightweight cookie-based auth (`frontend/src/lib/auth.ts`, `frontend/src/middleware.ts`); do not introduce external auth providers unless requested.

## Developer workflows
- Backend (repo root):
  - `npm install`
  - `npm run build` (TypeScript -> `dist/`)
  - `npm run dev` (ts-node local function)
  - `./setup.sh <PROJECT_ID>` (one-time GCP API/secrets setup)
  - `./deploy.sh --update-scheduler` (deploy + scheduler create/update)
- Frontend (`frontend/`):
  - `npm install`
  - `npm run dev` / `npm run build` / `npm run start`
- There are currently no test/lint scripts; validate changes by building the touched package(s) and exercising affected API routes/pages.

## Environment and integration points
- Backend secrets/env: `TUYA_ACCESS_KEY`, `TUYA_ACCESS_SECRET`, `TUYA_DEVICE_ID`, `TUYA_REGION` (see `.env.example` and `deploy.sh --set-secrets`).
- Frontend env: `GCP_FUNCTION_URL`, `AUTH_USERNAME`, `AUTH_PASSWORD`, `SESSION_SECRET` (see `frontend/.env.example`).
- Keep TypeScript path alias usage consistent in frontend (`@/*` -> `frontend/src/*`).

## When implementing changes
- Prefer minimal, surgical updates in existing files over introducing new abstractions.
- If adding a new curtain operation, implement backend route in `src/index.ts` first, then add matching proxy route under `frontend/src/app/api/curtain/`, then wire UI in `frontend/src/app/dashboard/*`.
- If changing schedule/config semantics, update both backend types in `src/types.ts` and dashboard config UI in `frontend/src/app/dashboard/config/page.tsx`.
