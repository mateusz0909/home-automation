#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Curtain Automation — GCP Deployment Script
# ============================================================
#
# Prerequisites:
#   1. gcloud CLI installed: https://cloud.google.com/sdk/docs/install
#   2. Logged in: gcloud auth login
#   3. Project set: gcloud config set project YOUR_PROJECT_ID
#   4. APIs enabled (see setup.sh)
#   5. Secrets created in Secret Manager (see setup.sh)
#
# Usage:
#   ./deploy.sh
#   ./deploy.sh --update-scheduler    # Also update Cloud Scheduler job
# ============================================================

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
REGION="us-central1"
FUNCTION_NAME="curtain-automation"
SCHEDULER_JOB_NAME="curtain-daily-open"
WORKFLOW_NAME="curtain-daily-open-workflow"
SCHEDULER_SA_NAME="curtain-scheduler-invoker"
SCHEDULER_SA_EMAIL="${SCHEDULER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
WORKFLOW_TEMPLATE="deploy/workflows/curtain-open.yaml.tmpl"
WORKFLOW_RENDERED="deploy/workflows/curtain-open.yaml"

echo "=== Building TypeScript ==="
npm run build

echo ""
echo "=== Deploying Cloud Function ==="
echo "Project: ${PROJECT_ID}"
echo "Region:  ${REGION}"
echo "Function: ${FUNCTION_NAME}"
echo ""

gcloud functions deploy "${FUNCTION_NAME}" \
  --gen2 \
  --runtime=nodejs22 \
  --region="${REGION}" \
  --source=. \
  --entry-point=curtainAutomation \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=3600s \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=1 \
  --concurrency=80 \
  --set-secrets="TUYA_ACCESS_KEY=tuya-access-key:latest,TUYA_ACCESS_SECRET=tuya-access-secret:latest,TUYA_DEVICE_ID=tuya-device-id:latest,TUYA_REGION=tuya-region:latest"

# Get the function URL
FUNCTION_URL=$(gcloud functions describe "${FUNCTION_NAME}" --gen2 --region="${REGION}" --format='value(serviceConfig.uri)')
echo ""
echo "=== Function deployed ==="
echo "URL: ${FUNCTION_URL}"

echo ""
echo "=== Deploying Cloud Workflow ==="
if [[ ! -f "${WORKFLOW_TEMPLATE}" ]]; then
  echo "Workflow template not found: ${WORKFLOW_TEMPLATE}"
  exit 1
fi

sed "s|__FUNCTION_URL__|${FUNCTION_URL}|g" "${WORKFLOW_TEMPLATE}" > "${WORKFLOW_RENDERED}"

gcloud workflows deploy "${WORKFLOW_NAME}" \
  --location="${REGION}" \
  --source="${WORKFLOW_RENDERED}"

WORKFLOW_EXEC_URL="https://workflowexecutions.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/workflows/${WORKFLOW_NAME}/executions"
echo "Workflow: ${WORKFLOW_NAME}"
echo "Execution URL: ${WORKFLOW_EXEC_URL}"

# Optionally create/update the Cloud Scheduler job
if [[ "${1:-}" == "--update-scheduler" ]]; then
  echo ""
  echo "=== Setting up Cloud Scheduler ==="

  if ! gcloud iam service-accounts describe "${SCHEDULER_SA_EMAIL}" &>/dev/null; then
    echo "Creating service account: ${SCHEDULER_SA_EMAIL}"
    gcloud iam service-accounts create "${SCHEDULER_SA_NAME}" \
      --display-name="Curtain Scheduler Invoker"
  fi

  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SCHEDULER_SA_EMAIL}" \
    --role="roles/workflows.invoker" >/dev/null

  # Check if job exists
  if gcloud scheduler jobs describe "${SCHEDULER_JOB_NAME}" --location="${REGION}" &>/dev/null; then
    echo "Updating existing scheduler job..."
    gcloud scheduler jobs update http "${SCHEDULER_JOB_NAME}" \
      --location="${REGION}" \
      --schedule="0 7 * * *" \
      --time-zone="Europe/Prague" \
      --uri="${WORKFLOW_EXEC_URL}" \
      --http-method=POST \
      --update-headers="Content-Type=application/json" \
      --message-body='{"argument":"{}"}' \
      --oauth-service-account-email="${SCHEDULER_SA_EMAIL}" \
      --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform" \
      --attempt-deadline=300s \
      --max-retry-attempts=0
  else
    echo "Creating new scheduler job..."
    gcloud scheduler jobs create http "${SCHEDULER_JOB_NAME}" \
      --location="${REGION}" \
      --schedule="0 7 * * *" \
      --time-zone="Europe/Prague" \
      --uri="${WORKFLOW_EXEC_URL}" \
      --http-method=POST \
      --headers="Content-Type=application/json" \
      --message-body='{"argument":"{}"}' \
      --oauth-service-account-email="${SCHEDULER_SA_EMAIL}" \
      --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform" \
      --attempt-deadline=300s \
      --max-retry-attempts=0
  fi

  echo "Scheduler job '${SCHEDULER_JOB_NAME}' configured."
  echo "Schedule: 0 7 * * * (7:00 AM Europe/Prague)"
fi

echo ""
echo "=== Done ==="
echo ""
echo "Test commands:"
echo "  curl ${FUNCTION_URL}/status                    # Check curtain position"
echo "  curl ${FUNCTION_URL}/config                    # View config"
echo "  curl -X POST ${FUNCTION_URL}/trigger           # Manual trigger"
echo "  gcloud workflows run ${WORKFLOW_NAME} --location=${REGION}"
echo "  curl -X PUT ${FUNCTION_URL}/config -H 'Content-Type: application/json' -d '{\"cronExpression\": \"0 8 * * *\"}'"
