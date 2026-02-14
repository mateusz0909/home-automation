/**
 * Type definitions for the curtain automation system.
 */

/** Tuya device status entry from the API */
export interface TuyaStatusEntry {
  code: string;
  value: string | number | boolean;
}

/** Tuya API response wrapper */
export interface TuyaResponse<T = unknown> {
  success: boolean;
  result: T;
  t: number;
  msg?: string;
  code?: number;
}

/** Automation schedule configuration stored in Firestore */
export interface AutomationConfig {
  /** Cron expression, e.g. "0 7 * * *" */
  cronExpression: string;
  /** IANA timezone, e.g. "Europe/Prague" */
  timezone: string;
  /** Percentage steps to open gradually, e.g. [10, 20, 30, ..., 90] */
  steps: number[];
  /** User-facing interval in seconds between successful steps */
  stepIntervalSeconds: number;
  /** Whether to send a final 'open' command after the last step */
  sendFinalOpen: boolean;
  /** Master enable/disable switch */
  enabled: boolean;
}

/** Request body for manual trigger */
export interface TriggerRequest {
  /** Override steps for this run */
  steps?: number[];
  /** Force run even if disabled */
  force?: boolean;
}

/** Request body for schedule update */
export interface UpdateScheduleRequest {
  cronExpression?: string;
  timezone?: string;
  steps?: number[];
  stepIntervalSeconds?: number;
  // Backward compatibility for old clients
  stepDelaySeconds?: number;
  sendFinalOpen?: boolean;
  enabled?: boolean;
}

/** Execution log entry */
export interface ExecutionLog {
  timestamp: string;
  trigger: 'scheduled' | 'manual';
  success: boolean;
  stepsCompleted: number;
  totalSteps: number;
  finalPosition: number | null;
  durationMs: number;
  error?: string;
}
