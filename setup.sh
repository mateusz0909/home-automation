#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Curtain Automation — GCP Initial Setup Script
# ============================================================
#
# Run this ONCE to set up the GCP project for the first time.
#
# Prerequisites:
#   1. gcloud CLI installed
#   2. Logged in: gcloud auth login
#   3. A GCP project created (with billing enabled)
#
# Usage:
#   ./setup.sh YOUR_PROJECT_ID
# ============================================================

if [[ $# -lt 1 ]]; then
  echo "Usage: ./setup.sh PROJECT_ID"
  echo ""
  echo "Example: ./setup.sh home-automation-12345"
  exit 1
fi

PROJECT_ID="$1"
REGION="us-central1"
WORKFLOW_NAME="curtain-daily-open-workflow"
SCHEDULER_SA_NAME="curtain-scheduler-invoker"
SCHEDULER_SA_EMAIL="${SCHEDULER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "=== Setting up GCP project: ${PROJECT_ID} ==="

# Set the active project
gcloud config set project "${PROJECT_ID}"

# Enable required APIs
echo ""
echo "--- Enabling APIs ---"
gcloud services enable \
  cloudfunctions.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  workflows.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com

echo ""
echo "--- Creating Scheduler service account for Workflows execution ---"
if gcloud iam service-accounts describe "${SCHEDULER_SA_EMAIL}" &>/dev/null; then
  echo "(Service account already exists)"
else
  gcloud iam service-accounts create "${SCHEDULER_SA_NAME}" \
    --display-name="Curtain Scheduler Invoker"
fi

echo ""
echo "--- Granting Scheduler service account workflow invoke role ---"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SCHEDULER_SA_EMAIL}" \
  --role="roles/workflows.invoker" >/dev/null

echo ""
echo "--- Granting Scheduler service account function invoke role (manual fallback) ---"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SCHEDULER_SA_EMAIL}" \
  --role="roles/run.invoker" >/dev/null

echo ""
echo "--- Creating Firestore database (Native mode) ---"
# This may fail if already exists — that's fine
gcloud firestore databases create \
  --location="${REGION}" \
  --type=firestore-native 2>/dev/null || echo "(Firestore database already exists)"

echo ""
echo "--- Creating secrets in Secret Manager ---"
echo "You will be prompted to enter each secret value."
echo ""

# Helper function to create or update a secret
create_secret() {
  local secret_name="$1"
  local prompt_text="$2"

  read -rp "${prompt_text}: " secret_value

  if gcloud secrets describe "${secret_name}" &>/dev/null; then
    echo "${secret_value}" | gcloud secrets versions add "${secret_name}" --data-file=-
    echo "  Updated secret: ${secret_name}"
  else
    echo "${secret_value}" | gcloud secrets create "${secret_name}" --data-file=- --replication-policy=automatic
    echo "  Created secret: ${secret_name}"
  fi
}

create_secret "tuya-access-key" "Enter Tuya Access Key (API Key)"
create_secret "tuya-access-secret" "Enter Tuya Access Secret"
create_secret "tuya-device-id" "Enter Tuya Device ID"
create_secret "tuya-region" "Enter Tuya API Region (eu/us/cn/in)"

echo ""
echo "--- Setting up budget alert ---"
echo "IMPORTANT: Set a budget alert manually in the GCP Console:"
echo "  https://console.cloud.google.com/billing/budgets?project=${PROJECT_ID}"
echo "  Recommended: Set a \$1 monthly budget with email alerts at 50%, 90%, 100%."

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Set the budget alert (link above)"
echo "  2. Run: npm install"
echo "  3. Run: npm run build"
echo "  4. Run: ./deploy.sh --update-scheduler"
echo ""
echo "Workflow to be deployed later: ${WORKFLOW_NAME}"
