# Copilot instructions for home-automation

## Big picture
- This repository is a single Next.js 15 application (`frontend/`) deployed to Vercel, designed to run 100% within free tiers.
- Key integrations:
  - **Tuya Cloud API**: Direct device control for curtains (`frontend/src/lib/tuya-client.ts`).
  - **Upstash Redis**: Stores configuration (`curtain:config`), schedule state (`curtain:schedule`), real-time status (`curtain:status`), and trimmed logs (`curtain:logs`) via `frontend/src/lib/storage.ts`.
  - **Upstash QStash & Workflow**: Handles dynamic cron scheduling via QStash Schedules API and multi-step gradual curtain opening workflows via `@upstash/workflow` (`frontend/src/app/api/curtain/workflow/route.ts`).
  - **Dashboard**: Simple authenticated dashboard in `frontend/src/app/dashboard/*` with quick controls, configuration, and execution logs.

## Service boundaries and routes
- API surface is organized under Next.js App Router (`frontend/src/app/api/curtain/*`):
  - `POST /api/curtain/trigger` — Trigger the gradual automation (invoked by QStash cron or dashboard manual trigger).
  - `POST /api/curtain/command` — Immediate `open|close|stop` command via Tuya client; immediately cancels any running workflow in Redis.
  - `GET /api/curtain/status` — Retrieves live curtain position from Tuya API + execution state from Redis.
  - `GET / PUT /api/curtain/config` — Retrieves / updates automation configuration in Redis; syncs QStash schedule when enabled state changes.
  - `GET / PUT /api/curtain/schedule` — Retrieves schedule state from Redis / updates cron schedule in both Redis and QStash Schedules API.
  - `GET / POST /api/curtain/logs` — Retrieves recent execution logs from Redis list.
  - `POST /api/curtain/workflow` — Upstash Workflow route serving step-by-step curtain opening with `context.run`, `context.sleep`, and cancellation checks.

## Project conventions
- Node.js runtime: All routes touching `@tuya/tuya-connector-nodejs` or `node:crypto` export `export const runtime = 'nodejs'`.
- Storage: Always use `frontend/src/lib/storage.ts` for Redis operations (`getConfig`, `updateConfig`, `getExecutionStatus`, `setExecutionStatus`, `cancelExecution`, `appendLog`, `getRecentLogs`).
- QStash Schedules: Schedule cron expressions include `CRON_TZ=Europe/Warsaw` (or user timezone) prefix for proper daylight saving time handling.
- Authentication: Session-cookie based auth (`frontend/src/lib/auth.ts`) for dashboard users; QStash signature verification (`frontend/src/lib/qstash.ts`) for scheduled webhooks.
- Path aliases: Consistent `@/*` referencing `frontend/src/*`.

## Environment Variables
- `TUYA_ACCESS_ID` (or `TUYA_ACCESS_KEY`), `TUYA_ACCESS_SECRET`, `TUYA_DEVICE_ID`, `TUYA_ENDPOINT` (or `TUYA_REGION`)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`
- `NEXT_PUBLIC_APP_URL` (or `VERCEL_PROJECT_PRODUCTION_URL`)
- `AUTH_USERNAME`, `AUTH_PASSWORD`, `SESSION_SECRET`
