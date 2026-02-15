import { TuyaClient } from './tuya-client';
import { AutomationConfig } from './types';

/**
 * Sleeps for the given number of seconds.
 */
function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function derivePollingSettings(stepIntervalSeconds: number): {
  effectiveStepIntervalSeconds: number;
  pollIntervalSeconds: number;
  pollTimeoutSeconds: number;
} {
  const safeStepInterval = clamp(stepIntervalSeconds, 5, 45);

  const pollIntervalSeconds = clamp(Math.round(safeStepInterval / 3), 2, 10);
  const pollTimeoutSeconds = clamp(Math.round(safeStepInterval * 2), 30, 300);

  return {
    effectiveStepIntervalSeconds: safeStepInterval,
    pollIntervalSeconds,
    pollTimeoutSeconds,
  };
}

/**
 * Waits for the curtain to reach (or exceed) the target position.
 * Polls the device status at the configured interval.
 *
 * Returns true if the target was reached, false on timeout.
 */
async function waitForPosition(
  client: TuyaClient,
  targetPercent: number,
  pollIntervalSeconds: number,
  timeoutSeconds: number
): Promise<boolean> {
  const startTime = Date.now();

  const initialPos = await client.getDeviceStatus();
  if (initialPos === null) {
    console.log('Could not determine initial position. Aborting wait.');
    return false;
  }

  console.log(
    `Waiting for curtain to move toward ${targetPercent}% (from ${initialPos}%)`
  );

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

export interface AutomationResult {
  success: boolean;
  stepsCompleted: number;
  totalSteps: number;
  finalPosition: number | null;
  error?: string;
}

/**
 * Runs the gradual curtain opening sequence.
 *
 * This is a faithful port of the Python automation.py logic:
 * 1. Loop through percentage steps (e.g., 10, 20, ..., 90)
 * 2. For each step: check current position, send command, wait for motor
 * 3. Optionally send a final 'open' command to reach 100%
 */
export async function runAutomation(
  client: TuyaClient,
  config: AutomationConfig
): Promise<AutomationResult> {
  const { steps, stepIntervalSeconds, sendFinalOpen } =
    config;
  const {
    effectiveStepIntervalSeconds,
    pollIntervalSeconds,
    pollTimeoutSeconds,
  } = derivePollingSettings(stepIntervalSeconds);

  console.log('Starting gradual opening sequence...');
  console.log(
    `Steps: [${steps.join(', ')}], interval: ${stepIntervalSeconds}s (effective: ${effectiveStepIntervalSeconds}s)`
  );
  console.log(
    `Auto polling: every ${pollIntervalSeconds}s, timeout ${pollTimeoutSeconds}s`
  );

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
      console.log(
        `Curtain is already at or beyond ${percent}%. Continuing...`
      );
      stepsCompleted++;
      continue;
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
      pollTimeoutSeconds
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
        console.log(
          `Still at ${finalCheck}%. Sending one more 'open' retry...`
        );
        const secondOpen = await client.sendDirectionalCommand('open');
        if (secondOpen) {
          await waitForPosition(
            client,
            100,
            pollIntervalSeconds,
            pollTimeoutSeconds
          );
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
