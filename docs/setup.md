# Curtain Automation — GCP Setup Guide

## Architecture

```
Cloud Scheduler (cron) ──HTTP POST──▶ Cloud Run Function (Node.js 22)
                                           │
You (manual trigger) ──HTTP POST──▶        ├──▶ Tuya Cloud API (curtain control)
                                           ├──▶ Firestore (schedule config)
                                           └──▶ Secret Manager (credentials)
```

**Cost: $0/month** — everything runs within GCP's Always Free tier.

---

## Prerequisites

1. **Google Cloud account** with billing enabled (credit card required, but won't be charged)
2. **gcloud CLI** installed: https://cloud.google.com/sdk/docs/install
3. **Node.js 22+** and npm
4. **Tuya IoT Developer account** with API credentials

---

## Step 1: Create a GCP Project

```bash
# Create a new project (or use an existing one)
gcloud projects create home-automation-curtains --name="Home Automation"

# Link it to your billing account
gcloud billing accounts list
gcloud billing projects link home-automation-curtains --billing-account=YOUR_BILLING_ACCOUNT_ID
```

---

## Step 2: Run the Setup Script

The setup script enables APIs, creates Firestore, and stores your Tuya credentials securely.

```bash
cd gcp-automation
./setup.sh home-automation-curtains
```

It will prompt you for:
- **Tuya Access Key** — from your Tuya IoT Platform project
- **Tuya Access Secret** — from your Tuya IoT Platform project
- **Tuya Device ID** — your curtain device's ID
- **Tuya Region** — `eu`, `us`, `cn`, or `in`

---

## Step 3: Set a Budget Alert (Important!)

GCP won't auto-stop at free limits. Set a safety budget:

1. Go to https://console.cloud.google.com/billing/budgets
2. Create a budget: **$1/month**
3. Set alerts at **50%, 90%, 100%**

For your usage (~1 invocation/day), you'll use **< 0.01%** of free quota.

---

## Step 4: Deploy

```bash
npm install
./deploy.sh --update-scheduler
```

This will:
1. Build the TypeScript source
2. Deploy the Cloud Function (Node.js 22, 9-minute timeout)
3. Create a Cloud Scheduler job (daily at 7:00 AM Europe/Prague)

---

## API Endpoints

After deployment, your function URL will be printed. The available endpoints are:

| Method | Path | Description |
|--------|---------|--------------------------------------|
| `POST` | `/` or `/trigger` | Run the curtain automation |
| `GET` | `/status` | Get current curtain position |
| `GET` | `/config` | View automation configuration |
| `PUT` | `/config` | Update configuration |
| `GET` | `/logs` | View recent execution logs |

### Examples

```bash
FUNCTION_URL="https://curtain-automation-xxxxx-uc.a.run.app"

# Check current curtain position
curl $FUNCTION_URL/status

# Manually trigger the automation
curl -X POST $FUNCTION_URL/trigger

# View config
curl $FUNCTION_URL/config

# Change the schedule to 8 AM
curl -X PUT $FUNCTION_URL/config \
  -H "Content-Type: application/json" \
  -d '{"cronExpression": "0 8 * * *"}'

# Disable the automation
curl -X PUT $FUNCTION_URL/config \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'

# Change step configuration
curl -X PUT $FUNCTION_URL/config \
  -H "Content-Type: application/json" \
  -d '{"steps": [20, 40, 60, 80], "stepIntervalSeconds": 20}'

# Trigger with custom steps (one-time override)
curl -X POST $FUNCTION_URL/trigger \
  -H "Content-Type: application/json" \
  -d '{"steps": [50, 100]}'

# Force trigger even when disabled
curl -X POST $FUNCTION_URL/trigger \
  -H "Content-Type: application/json" \
  -d '{"force": true}'

# View last 5 execution logs
curl "$FUNCTION_URL/logs?limit=5"
```

---

## Configuration Reference

The config is stored in Firestore (`curtain-automation/config`) and can be updated via the `/config` API:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `cronExpression` | string | `"0 7 * * *"` | Cron schedule |
| `timezone` | string | `"Europe/Prague"` | IANA timezone |
| `steps` | number[] | `[10,20,...,90]` | Percentage steps |
| `stepIntervalSeconds` | number | `15` | Interval between steps |
| `sendFinalOpen` | boolean | `true` | Send 'open' command after last step |
| `enabled` | boolean | `true` | Master on/off switch |

`pollIntervalSeconds` and `pollTimeoutSeconds` are now automatically derived in backend for safer defaults.

> **Note:** The Cloud Scheduler job must be manually updated if you change `cronExpression` via the config API. The config API updates Firestore only. To also update the scheduler: `./deploy.sh --update-scheduler`

---

## Updating the Schedule via Cloud Scheduler

To change the cron schedule:

```bash
gcloud scheduler jobs update http curtain-daily-open \
  --location=us-central1 \
  --schedule="30 6 * * 1-5" \
  --time-zone="Europe/Prague"
```

This example runs at 6:30 AM on weekdays only.

---

## Monitoring

- **Logs**: `gcloud functions logs read curtain-automation --gen2 --region=us-central1 --limit=50`
- **Cloud Console**: https://console.cloud.google.com/functions
- **Execution history**: `curl $FUNCTION_URL/logs`

---

## GCP Free Tier Limits (your usage)

| Resource | Free Quota | Your Usage | % Used |
|----------|-----------|------------|--------|
| Cloud Function invocations | 2M/month | ~30/month | 0.002% |
| CPU (vCPU-seconds) | 180,000/month | ~12,600/month | 7% |
| Memory (GiB-seconds) | 360,000/month | ~3,150/month | 0.9% |
| Cloud Scheduler jobs | 3 | 1 | 33% |
| Firestore reads | 50,000/day | ~10/day | 0.02% |
| Firestore writes | 20,000/day | ~2/day | 0.01% |
| Secret Manager versions | 6 | 4 | 67% |
