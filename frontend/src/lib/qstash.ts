import { NextRequest } from 'next/server';
import { Client as QStashClient, Receiver } from '@upstash/qstash';
import { Client as WorkflowClient } from '@upstash/workflow';
import { AutomationConfig } from './types';
import { setScheduleState } from './storage';

export const SCHEDULE_ID = 'curtain-open-schedule';

/**
 * Returns the public app URL for webhooks and QStash callbacks.
 */
export function getAppUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;
  if (!raw) {
    return 'http://localhost:3000';
  }
  // QStash rejects destinations without a scheme
  const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/$/, '');
}

/**
 * Returns a QStash Client instance.
 */
export function getQStashClient(): QStashClient {
  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    throw new Error('QSTASH_TOKEN is not configured');
  }
  return new QStashClient({ token });
}

/**
 * Verifies QStash signature on incoming requests using Receiver.
 */
export async function verifyQStashSignature(
  req: NextRequest,
  rawBody: string
): Promise<boolean> {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!currentSigningKey || !nextSigningKey) {
    console.warn('QStash signing keys not configured; signature verification skipped or failed');
    return false;
  }

  const signature = req.headers.get('upstash-signature');
  if (!signature) {
    return false;
  }

  try {
    const receiver = new Receiver({
      currentSigningKey,
      nextSigningKey,
    });

    return await receiver.verify({
      signature,
      body: rawBody,
    });
  } catch (error) {
    console.error('Error verifying QStash signature:', error);
    return false;
  }
}

/**
 * Formats cron expression with timezone prefix for QStash, e.g. "CRON_TZ=Europe/Warsaw 0 7 * * *".
 */
export function formatQStashCron(cron: string, timezone: string = 'Europe/Warsaw'): string {
  const trimmed = cron.trim();
  if (trimmed.startsWith('CRON_TZ=')) {
    return trimmed;
  }
  const tz = timezone || 'Europe/Warsaw';
  return `CRON_TZ=${tz} ${trimmed}`;
}

/**
 * Synchronizes the schedule with Upstash QStash Schedules API and updates Redis state.
 */
export async function syncQStashSchedule(config: AutomationConfig): Promise<void> {
  const token = process.env.QSTASH_TOKEN;
  const state = config.enabled ? 'ENABLED' : 'PAUSED';

  if (!token) {
    console.warn('QSTASH_TOKEN not configured; skipping QStash schedule synchronization.');
    await setScheduleState({
      schedule: config.cronExpression,
      timezone: config.timezone,
      state,
      scheduleId: SCHEDULE_ID,
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  try {
    const qstash = getQStashClient();
    const appUrl = getAppUrl();
    const destination = `${appUrl}/api/curtain/trigger`;
    const cron = formatQStashCron(config.cronExpression, config.timezone);

    if (config.enabled) {
      // Same scheduleId overwrites the existing schedule; a failed create keeps the old one
      await qstash.schedules.create({
        destination,
        cron,
        scheduleId: SCHEDULE_ID,
        body: JSON.stringify({ trigger: 'scheduled' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      console.log(`QStash schedule configured: ${SCHEDULE_ID} -> ${destination} (${cron})`);
    } else {
      try {
        await qstash.schedules.delete(SCHEDULE_ID);
      } catch {
        // Ignore if schedule didn't exist
      }
      console.log(`Automation disabled; QStash schedule ${SCHEDULE_ID} removed.`);
    }

    await setScheduleState({
      schedule: config.cronExpression,
      timezone: config.timezone,
      state,
      scheduleId: SCHEDULE_ID,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to sync QStash schedule:', error);
    throw error;
  }
}

/**
 * Triggers the Upstash workflow for gradual curtain opening.
 */
export async function triggerWorkflow(params: {
  trigger: 'scheduled' | 'manual';
  force?: boolean;
  steps?: number[];
  runId?: string;
}): Promise<{ workflowRunId?: string }> {
  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    throw new Error('QSTASH_TOKEN is not configured');
  }

  const client = new WorkflowClient({ token });
  const appUrl = getAppUrl();
  const destination = `${appUrl}/api/curtain/workflow`;

  const runId = params.runId || `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const result = await client.trigger({
    url: destination,
    body: {
      ...params,
      runId,
    },
  });

  return { workflowRunId: result.workflowRunId };
}
