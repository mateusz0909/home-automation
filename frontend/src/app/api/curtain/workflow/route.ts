import { serve } from '@upstash/workflow/nextjs';
import { getTuyaClient } from '@/lib/tuya-client';
import { runSingleStep } from '@/lib/automation';
import {
  getConfig,
  appendLog,
  setExecutionStatus,
  getExecutionStatus,
} from '@/lib/storage';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface WorkflowPayload {
  runId?: string;
  trigger?: 'scheduled' | 'manual';
  steps?: number[];
  force?: boolean;
}

export const { POST } = serve<WorkflowPayload>(async (context) => {
  const payload = context.requestPayload;
  const trigger = payload?.trigger || 'scheduled';
  const runId = payload?.runId || context.workflowRunId;

  // Step 1: Load automation configuration
  const config = await context.run('load-config', async () => {
    return await getConfig();
  });

  // Skip if disabled (unless forced)
  if (!config.enabled && !payload?.force) {
    await context.run('log-disabled', async () => {
      await appendLog({
        timestamp: new Date().toISOString(),
        trigger,
        success: true,
        stepsCompleted: 0,
        totalSteps: config.steps.length,
        finalPosition: null,
        durationMs: 0,
        error: 'Automation disabled',
      });
      await setExecutionStatus({
        state: 'idle',
        updatedAt: new Date().toISOString(),
      });
    });

    return {
      success: true,
      skipped: true,
      reason: 'Automation disabled',
    };
  }

  const stepsToRun =
    payload?.steps && payload.steps.length > 0 ? payload.steps : config.steps;
  const startedAtMs = Date.now();

  // Step 2: Initialize execution status
  await context.run('init-status', async () => {
    await setExecutionStatus({
      state: 'running',
      runId,
      currentStep: 0,
      totalSteps: stepsToRun.length,
      startedAt: new Date(startedAtMs).toISOString(),
      updatedAt: new Date().toISOString(),
      trigger,
    });
  });

  let completedSteps = 0;
  let lastPosition: number | null = null;

  // Step 3: Run incremental percentage steps
  for (let i = 0; i < stepsToRun.length; i++) {
    const targetPercent = stepsToRun[i];

    const stepResult = await context.run(`step-${i}-${targetPercent}`, async () => {
      // Check cancellation before moving
      const currentStatus = await getExecutionStatus();
      if (
        currentStatus.state === 'cancelled' ||
        (currentStatus.runId && currentStatus.runId !== runId)
      ) {
        return {
          cancelled: true,
          success: false,
          error: 'Cancelled by user command',
          targetPercent,
          startPosition: null,
          finalPosition: null,
        };
      }

      await setExecutionStatus({
        state: 'running',
        runId,
        currentStep: i + 1,
        totalSteps: stepsToRun.length,
        targetPercent,
        startedAt: new Date(startedAtMs).toISOString(),
        updatedAt: new Date().toISOString(),
        trigger,
      });

      const client = getTuyaClient();
      return await runSingleStep(client, targetPercent, config.stepIntervalSeconds);
    });

    if (stepResult.cancelled) {
      await context.run('log-cancelled', async () => {
        await appendLog({
          timestamp: new Date().toISOString(),
          trigger,
          success: false,
          stepsCompleted: completedSteps,
          totalSteps: stepsToRun.length,
          finalPosition: lastPosition,
          durationMs: Date.now() - startedAtMs,
          error: 'Execution cancelled by manual command',
        });
        await setExecutionStatus({
          state: 'idle',
          updatedAt: new Date().toISOString(),
        });
      });
      return { success: false, cancelled: true };
    }

    if (!stepResult.success) {
      await context.run('log-step-failure', async () => {
        await appendLog({
          timestamp: new Date().toISOString(),
          trigger,
          success: false,
          stepsCompleted: completedSteps,
          totalSteps: stepsToRun.length,
          finalPosition: stepResult.finalPosition ?? lastPosition,
          durationMs: Date.now() - startedAtMs,
          error: stepResult.error || `Step ${i + 1} (${targetPercent}%) failed`,
        });
        await setExecutionStatus({
          state: 'idle',
          updatedAt: new Date().toISOString(),
        });
      });
      return { success: false, error: stepResult.error };
    }

    completedSteps++;
    lastPosition = stepResult.finalPosition;

    // Wait between steps
    if (i < stepsToRun.length - 1) {
      await context.sleep(`wait-step-${i}`, config.stepIntervalSeconds);
    }
  }

  // Step 4: Final open command to reach 100%
  if (config.sendFinalOpen) {
    const finalResult = await context.run('send-final-open', async () => {
      const currentStatus = await getExecutionStatus();
      if (
        currentStatus.state === 'cancelled' ||
        (currentStatus.runId && currentStatus.runId !== runId)
      ) {
        return { cancelled: true, position: lastPosition };
      }

      const client = getTuyaClient();
      await client.sendDirectionalCommand('open');
      await new Promise((r) => setTimeout(r, 2000));
      const pos = await client.getDeviceStatus();
      return { cancelled: false, position: pos };
    });

    if (finalResult.cancelled) {
      return { success: false, cancelled: true };
    }

    if (finalResult.position !== null && finalResult.position !== undefined) {
      lastPosition = finalResult.position;
    }
  }

  // Step 5: Log successful completion
  await context.run('log-success', async () => {
    await appendLog({
      timestamp: new Date().toISOString(),
      trigger,
      success: true,
      stepsCompleted: completedSteps,
      totalSteps: stepsToRun.length,
      finalPosition: lastPosition,
      durationMs: Date.now() - startedAtMs,
    });
    await setExecutionStatus({
      state: 'idle',
      updatedAt: new Date().toISOString(),
    });
  });

  return {
    success: true,
    stepsCompleted: completedSteps,
    totalSteps: stepsToRun.length,
    finalPosition: lastPosition,
  };
});
