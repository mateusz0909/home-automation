# Curtain Automation — Vercel + Upstash Setup Guide

## Architecture

```
Upstash QStash (cron) ──HTTP POST──▶ Next.js API Routes (Vercel)
                                            │
Dashboard (manual) ──HTTP POST─────▶       ├──▶ Tuya Cloud API (curtain motor)
                                            ├──▶ Upstash Redis (config, state, logs)
                                            └──▶ Upstash Workflow (step delays & orchestration)
```

**Cost: $0/month** — everything runs within the free tiers of Vercel and Upstash.

---

## Prerequisites

1. **Vercel Account** (Free Hobby Tier): https://vercel.com
2. **Upstash Account** (Free Tier): https://upstash.com
3. **Tuya IoT Developer Account** with Cloud project and curtain device

---

## Setup Steps

### 1. Create Upstash Redis Database
1. In the [Upstash Console](https://console.upstash.com/), create a new Redis database (free tier).
2. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

### 2. Create Upstash QStash
1. In the [Upstash Console](https://console.upstash.com/), navigate to QStash.
2. Copy:
   - `QSTASH_TOKEN`
   - `QSTASH_CURRENT_SIGNING_KEY`
   - `QSTASH_NEXT_SIGNING_KEY`

### 3. Deploy to Vercel
1. Import this repository into Vercel with Root Directory set to `frontend`.
2. Add all environment variables listed in `.env.example` in your Vercel Project Settings.
3. Deploy!
