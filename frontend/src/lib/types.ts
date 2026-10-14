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

/** Automation schedule configuration stored in Redis */
export interface AutomationConfig {
  /** Cron expression, e.g. "0 7 * * *" */
  cronExpression: string;
  /** IANA timezone, e.g. "Europe/Warsaw" or "Europe/Prague" */
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

/** Request body for workflow-run summary logging */
export interface WorkflowExecutionLogRequest {
  success: boolean;
  stepsCompleted: number;
  totalSteps: number;
  finalPosition: number | null;
  startedAt?: string;
  error?: string;
}

/** Real-time execution status stored in Redis under curtain:status */
export interface AutomationStatus {
  state: 'idle' | 'running' | 'cancelled';
  currentStep?: number;
  totalSteps?: number;
  targetPercent?: number;
  runId?: string;
  startedAt?: string;
  updatedAt?: string;
  trigger?: 'scheduled' | 'manual';
  error?: string;
}

/** Result of a single automation step */
export interface StepExecutionResult {
  success: boolean;
  targetPercent: number;
  startPosition: number | null;
  finalPosition: number | null;
  cancelled?: boolean;
  error?: string;
}

/** Full automation sequence result */
export interface AutomationResult {
  success: boolean;
  stepsCompleted: number;
  totalSteps: number;
  finalPosition: number | null;
  error?: string;
}

export interface AutomationRunOptions {
  maxTotalDurationSeconds?: number;
}
