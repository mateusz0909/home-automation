# Home Automation — Smart Curtain Controller

A serverless home automation application for smart curtains powered by Next.js, Tuya IoT Cloud, Upstash Redis, and Upstash QStash & Workflow. Hosted 100% free on Vercel.

---

## Features

- **☀️ Multi-Step Gradual Opening**: Opens curtains incrementally (e.g., 10%, 20%, ..., 90%, 100%) with configurable pauses between steps to simulate a gentle sunrise wake-up.
- **⚡ Serverless Workflow Execution**: Uses **Upstash Workflow** with `context.sleep(...)` and `context.run(...)` to execute multi-step routines across serverless function lifecycles without timeouts.
- **⏰ Dynamic Scheduling**: Manages automated cron schedules via **Upstash QStash Schedules API** with automatic timezone and DST handling (`CRON_TZ=Europe/Warsaw`).
- **🛑 Instant Cancellation**: Manual controls (`open`, `close`, `stop`) instantly cancel running gradual workflows via Redis state updates.
- **📊 Real-time Dashboard**: Authenticated web dashboard for device controls, schedule configuration, live curtain status, and execution logs.
- **💰 100% Free Tier**: Built entirely on free tiers of Vercel, Upstash Redis, and Upstash QStash.

---

## Architecture

```
                       ┌──────────────────────┐
                       │ Upstash QStash Cron  │
                       └──────────┬───────────┘
                                  │ (CRON_TZ)
                                  ▼
┌──────────────────┐    ┌───────────────────────────────────┐    ┌───────────────────────────┐
│ Web Dashboard UI │───▶│   Next.js 15 App on Vercel        │───▶│ Upstash Redis             │
└──────────────────┘    │   (/api/curtain/*)                │    │ (Config, Status, Logs)    │
                        └─────────┬───────────────────────┬─┘    └───────────────────────────┘
                                  │                       │
                                  ▼                       ▼
                       ┌──────────────────────┐   ┌──────────────────────────────────┐
                       │  Upstash Workflow    │   │  Tuya IoT Cloud API              │
                       │  (Step orchestration)│   │  (Smart Curtain Motor Control)   │
                       └──────────────────────┘   └──────────────────────────────────┘
```

---

## Required Environment Variables

Configure these in your Vercel Project Settings (`Settings` -> `Environment Variables`):

| Variable | Description | Example / Default |
|---|---|---|
| `TUYA_ACCESS_ID` | Tuya Developer Client ID / Access ID | `your_tuya_access_id` |
| `TUYA_ACCESS_SECRET` | Tuya Developer Access Secret | `your_tuya_access_secret` |
| `TUYA_DEVICE_ID` | Device ID of the curtain motor | `your_device_id` |
| `TUYA_ENDPOINT` | Regional API code or URL (`eu`, `us`, `cn`, `in`) | `eu` |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST database URL | `https://xxxx.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST access token | `your_redis_token` |
| `QSTASH_TOKEN` | Upstash QStash authentication token | `your_qstash_token` |
| `QSTASH_CURRENT_SIGNING_KEY` | Upstash QStash current signature verification key | `sig_curr_xxxx` |
| `QSTASH_NEXT_SIGNING_KEY` | Upstash QStash next signature verification key | `sig_next_xxxx` |
| `NEXT_PUBLIC_APP_URL` | Deployed production URL (used for QStash callbacks) | `https://your-app.vercel.app` |
| `AUTH_USERNAME` | Dashboard login username | `admin` |
| `AUTH_PASSWORD` | Dashboard login password | `your_strong_password` |
| `SESSION_SECRET` | Secret string for session cookies | `random_secret_string` |

---

## Local Development

1. Navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment configuration and fill in your keys:
   ```bash
   cp .env.example .env.local
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) to access the dashboard.
