import { TuyaClient } from './tuya-client';
import { AutomationConfig, AutomationResult, AutomationRunOptions, StepExecutionResult } from './types';

/**
 * Sleeps for the given number of seconds.
 */
function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function derivePollingSettings(stepIntervalSeconds: number): {
  effectiveStepIntervalSeconds: number;
  pollIntervalSeconds: number;
  pollTimeoutSeconds: number;
} {
  const safeStepInterval = clamp(stepIntervalSeconds, 5, 360);

  const pollIntervalSeconds = clamp(Math.round(safeStepInterval / 3), 2, 10);
  const pollTimeoutSeconds = clamp(Math.round(safeStepInterval * 2), 30, 720);

  return {
    effectiveStepIntervalSeconds: safeStepInterval,
    pollIntervalSeconds,
    pollTimeoutSeconds,
  };
}

export function estimateMinimumRuntimeSeconds(
  stepCount: number,
  stepIntervalSeconds: number,
  pollIntervalSeconds: number,
  includeFinalOpen: boolean
): number {
  if (stepCount <= 0) {
    return 0;
  }

  const betweenSteps = Math.max(0, stepCount - 1) * stepIntervalSeconds;
  const stepChecks = stepCount * pollIntervalSeconds;
  const finalOpenCheck = includeFinalOpen ? pollIntervalSeconds : 0;

  return betweenSteps + stepChecks + finalOpenCheck;
}

/**
 * Waits for the curtain to reach (or exceed) the target position.
 * Polls the device status at the configured interval.
 *
 * Returns true if the target was reached, false on timeout.
 */
export async function waitForPosition(
  client: TuyaClient,
  targetPercent: number,
  pollIntervalSeconds: number,
  timeoutSeconds: number,
  onStall?: (currentPercent: number, attempt: number) => Promise<boolean>
): Promise<boolean> {
  const startTime = Date.now();
  const maxStallRecoveries = 2;
  const pollsBeforeRecovery = 3;

  const initialPos = await client.getDeviceStatus();
  if (initialPos === null) {
    console.log('Could not determine initial position. Aborting wait.');
    return false;
  }

  console.log(
    `Waiting for curtain to move toward ${targetPercent}% (from ${initialPos}%)`
  );

  let lastObservedPos = initialPos;
  let noMovementPolls = 0;
  let recoveryAttempts = 0;

  while ((Date.now() - startTime) / 1000 < timeoutSeconds) {
    await sleep(pollIntervalSeconds);

    const currentPos = await client.getDeviceStatus();

    if (currentPos !== null) {
      console.log(
        `Status check... Current: ${currentPos}%, Target: ${targetPercent}%`
      );
      if (currentPos >= targetPercent) {
        console.log('Target position reached.');
        return true;
      }

      if (currentPos > lastObservedPos) {
        lastObservedPos = currentPos;
        noMovementPolls = 0;
      } else {
        noMovementPolls++;

        if (
          onStall &&
          recoveryAttempts < maxStallRecoveries &&
          noMovementPolls >= pollsBeforeRecovery
        ) {
          const attempt = recoveryAttempts + 1;
          console.warn(
            `No movement detected for ${noMovementPolls} polls at ${currentPos}%. Running recovery attempt ${attempt}/${maxStallRecoveries}...`
          );

          const recovered = await onStall(currentPos, attempt);
          if (recovered) {
            recoveryAttempts = attempt;
            noMovementPolls = 0;
          }
        }
      }
    } else {
      console.warn('Warning: Failed to get status during a check.');
    }
  }

  // Timeout reached
  console.log(`Timeout of ${timeoutSeconds}s reached.`);
  const finalPos = await client.getDeviceStatus();

  if (finalPos !== null && initialPos !== null && finalPos > initialPos) {
    console.log(
      `Curtain moved to ${finalPos}% but did not reach target ${targetPercent}%.`
    );
  } else {
    console.log(
      `Curtain failed to move from ${initialPos}%. The command may have been ignored.`
    );
  }

  return false;
}

/**
 * Executes one automation step (move curtain to target percent).
 * Used within serverless workflows (e.g. Upstash Workflow or QStash step chaining).
 */
export async function runSingleStep(
  client: TuyaClient,
  targetPercent: number,
  stepIntervalSeconds: number
): Promise<StepExecutionResult> {
  const safeTarget = clamp(Math.round(targetPercent), 0, 100);
  const { pollIntervalSeconds, pollTimeoutSeconds } =
    derivePollingSettings(stepIntervalSeconds);

  const currentPercent = await client.getDeviceStatus();
  if (currentPercent === null) {
    return {
      success: false,
      targetPercent: safeTarget,
      startPosition: null,
      finalPosition: null,
      error: 'Failed to get device status',
    };
  }

  if (currentPercent >= safeTarget) {
    return {
      success: true,
      targetPercent: safeTarget,
      startPosition: currentPercent,
      finalPosition: currentPercent,
    };
  }

  const commandSuccess = await client.setDevicePercent(safeTarget);
  if (!commandSuccess) {
    return {
      success: false,
      targetPercent: safeTarget,
      startPosition: currentPercent,
      finalPosition: currentPercent,
      error: `Command to set ${safeTarget}% failed`,
    };
  }

  const reached = await waitForPosition(
    client,
    safeTarget,
    pollIntervalSeconds,
    pollTimeoutSeconds,
    async (_currentPos, attempt) => {
      if (attempt === 1) {
        console.log(`Recovery ${attempt}: re-sending percent ${safeTarget}%`);
        return client.setDevicePercent(safeTarget);
      }

      console.log(
        `Recovery ${attempt}: sending 'open' then re-sending percent ${safeTarget}%`
      );
      const openOk = await client.sendDirectionalCommand('open');
      if (!openOk) {
        return false;
      }

      await sleep(2);
      return client.setDevicePercent(safeTarget);
    }
  );

  const finalPosition = await client.getDeviceStatus();
  if (!reached) {
    return {
      success: false,
      targetPercent: safeTarget,
      startPosition: currentPercent,
      finalPosition,
      error: `Curtain did not reach ${safeTarget}% (timeout or stall)`,
    };
  }

  return {
    success: true,
    targetPercent: safeTarget,
    startPosition: currentPercent,
    finalPosition,
  };
}

/**
 * Runs the complete gradual curtain opening sequence in-memory.
 */
export async function runAutomation(
  client: TuyaClient,
  config: AutomationConfig,
  options: AutomationRunOptions = {}
): Promise<AutomationResult> {
  const { steps, stepIntervalSeconds, sendFinalOpen } = config;
  const {
    effectiveStepIntervalSeconds,
    pollIntervalSeconds,
    pollTimeoutSeconds,
  } = derivePollingSettings(stepIntervalSeconds);
  const maxTotalDurationSeconds =
    typeof options.maxTotalDurationSeconds === 'number'
      ? Math.max(30, Math.round(options.maxTotalDurationSeconds))
      : undefined;

  console.log('Starting gradual opening sequence...');
  console.log(
    `Steps: [${steps.join(', ')}], interval: ${stepIntervalSeconds}s (effective: ${effectiveStepIntervalSeconds}s)`
  );
  console.log(
    `Auto polling: every ${pollIntervalSeconds}s, timeout ${pollTimeoutSeconds}s`
  );

  const estimatedMinimumRuntimeSeconds = estimateMinimumRuntimeSeconds(
    steps.length,
    effectiveStepIntervalSeconds,
    pollIntervalSeconds,
    sendFinalOpen
  );
  console.log(`Estimated minimum runtime: ${estimatedMinimumRuntimeSeconds}s`);

  if (
    maxTotalDurationSeconds !== undefined &&
    estimatedMinimumRuntimeSeconds > maxTotalDurationSeconds
  ) {
    return {
      success: false,
      stepsCompleted: 0,
      totalSteps: steps.length,
      finalPosition: await client.getDeviceStatus(),
      error:
        `Estimated runtime ${estimatedMinimumRuntimeSeconds}s exceeds maximum allowed ${maxTotalDurationSeconds}s. ` +
        'Reduce step interval or number of steps.',
    };
  }

  const startedAt = Date.now();
  const isOutOfTimeBudget = (): boolean => {
    if (maxTotalDurationSeconds === undefined) {
      return false;
    }
    const elapsedSeconds = (Date.now() - startedAt) / 1000;
    return elapsedSeconds >= maxTotalDurationSeconds;
  };

  let stepsCompleted = 0;

  for (const percent of steps) {
    console.log('\n' + '='.repeat(20));

    const currentPercent = await client.getDeviceStatus();
    if (currentPercent === null) {
      return {
        success: false,
        stepsCompleted,
        totalSteps: steps.length,
        finalPosition: null,
        error: 'Failed to get device status',
      };
    }

    console.log(`Current curtain position: ${currentPercent}%`);

    if (currentPercent >= percent) {
      console.log(`Curtain is already at or beyond ${percent}%. Continuing...`);
      stepsCompleted++;
      continue;
    }

    if (isOutOfTimeBudget()) {
      return {
        success: false,
        stepsCompleted,
        totalSteps: steps.length,
        finalPosition: currentPercent,
        error:
          'Automation stopped before timeout to stay within execution deadline. Reduce step interval or steps.',
      };
    }

    const commandSuccess = await client.setDevicePercent(percent);
    if (!commandSuccess) {
      return {
        success: false,
        stepsCompleted,
        totalSteps: steps.length,
        finalPosition: currentPercent,
        error: `Command to set ${percent}% failed`,
      };
    }

    const reached = await waitForPosition(
      client,
      percent,
      pollIntervalSeconds,
      pollTimeoutSeconds,
      async (_currentPos, attempt) => {
        if (attempt === 1) {
          console.log(`Recovery ${attempt}: re-sending percent ${percent}%`);
          return client.setDevicePercent(percent);
        }

        console.log(
          `Recovery ${attempt}: sending 'open' then re-sending percent ${percent}%`
        );
        const openOk = await client.sendDirectionalCommand('open');
        if (!openOk) {
          return false;
        }
        await sleep(2);
        return client.setDevicePercent(percent);
      }
    );

    if (!reached) {
      const pos = await client.getDeviceStatus();
      return {
        success: false,
        stepsCompleted,
        totalSteps: steps.length,
        finalPosition: pos,
        error: `Curtain did not reach ${percent}% (timeout or stall)`,
      };
    }

    stepsCompleted++;
    const isLastStep = stepsCompleted >= steps.length;
    if (!isLastStep) {
      if (isOutOfTimeBudget()) {
        const pos = await client.getDeviceStatus();
        return {
          success: false,
          stepsCompleted,
          totalSteps: steps.length,
          finalPosition: pos,
          error:
            'Automation stopped before timeout to stay within execution deadline. Reduce step interval or steps.',
        };
      }

      console.log(
        `Successfully moved to ~${percent}%. Waiting ${effectiveStepIntervalSeconds}s before next step...`
      );
      await sleep(effectiveStepIntervalSeconds);
    }
  }

  // Final step: send 'open' command to reach 100%
  if (sendFinalOpen) {
    console.log('\n' + '='.repeat(20));
    console.log(
      'Gradual opening complete. Sending final command to fully open to 100%.'
    );

    const openSuccess = await client.sendDirectionalCommand('open');
    if (openSuccess) {
      await waitForPosition(client, 100, pollIntervalSeconds, pollTimeoutSeconds);
    }

    let finalCheck = await client.getDeviceStatus();
    if (finalCheck !== null && finalCheck < 99) {
      console.log(
        `Final position is ${finalCheck}%. Retrying with explicit 100% command...`
      );
      const force100Success = await client.setDevicePercent(100);
      if (force100Success) {
        await waitForPosition(client, 100, pollIntervalSeconds, pollTimeoutSeconds);
      }

      finalCheck = await client.getDeviceStatus();
      if (finalCheck !== null && finalCheck < 99) {
        console.log(`Still at ${finalCheck}%. Sending one more 'open' retry...`);
        const secondOpen = await client.sendDirectionalCommand('open');
        if (secondOpen) {
          await waitForPosition(client, 100, pollIntervalSeconds, pollTimeoutSeconds);
        }
      }
    }
  }

  const finalPosition = await client.getDeviceStatus();
  console.log(`\nSequence finished. Final position: ${finalPosition}%`);

  return {
    success: true,
    stepsCompleted,
    totalSteps: steps.length,
    finalPosition,
  };
}
