import { Redis } from '@upstash/redis';
import { AutomationConfig, ExecutionLog, AutomationStatus } from './types';
import { clamp } from './automation';

/** Default configuration used when no Redis key exists yet */
export const DEFAULT_CONFIG: AutomationConfig = {
  cronExpression: '0 7 * * *',
  timezone: 'Europe/Warsaw',
  steps: [10, 20, 30, 40, 50, 60, 70, 80, 90],
  stepIntervalSeconds: 15,
  sendFinalOpen: true,
  enabled: true,
};

const KEY_CONFIG = 'curtain:config';
const KEY_SCHEDULE = 'curtain:schedule';
const KEY_STATUS = 'curtain:status';
const KEY_LOGS = 'curtain:logs';

const MIN_STEP_INTERVAL_SECONDS = 5;
const MAX_STEP_INTERVAL_SECONDS = 360;

function sanitizeSteps(input: unknown): number[] | undefined {
  if (!Array.isArray(input)) {
    return undefined;
  }

  const cleaned = input
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n))
    .map((n) => Math.round(n))
    .filter((n) => n >= 0 && n <= 100)
    .sort((a, b) => a - b)
    .filter((n, idx, arr) => idx === 0 || n !== arr[idx - 1]);

  return cleaned.length > 0 ? cleaned : undefined;
}

function applyRuntimeSafety(config: AutomationConfig): AutomationConfig {
  const safeSteps = sanitizeSteps(config.steps) || [...DEFAULT_CONFIG.steps];
  const requestedInterval =
    typeof config.stepIntervalSeconds === 'number'
      ? config.stepIntervalSeconds
      : DEFAULT_CONFIG.stepIntervalSeconds;

  return {
    ...config,
    steps: safeSteps,
    stepIntervalSeconds: clamp(
      requestedInterval,
      MIN_STEP_INTERVAL_SECONDS,
      MAX_STEP_INTERVAL_SECONDS
    ),
  };
}

function normalizeConfig(input: Record<string, unknown>): Partial<AutomationConfig> {
  const legacyStepDelay =
    typeof input.stepDelaySeconds === 'number' ? input.stepDelaySeconds : undefined;

  const stepIntervalCandidate =
    typeof input.stepIntervalSeconds === 'number'
      ? input.stepIntervalSeconds
      : legacyStepDelay;

  const normalizedStepInterval =
    typeof stepIntervalCandidate === 'number'
      ? clamp(
          Math.round(stepIntervalCandidate),
          MIN_STEP_INTERVAL_SECONDS,
          MAX_STEP_INTERVAL_SECONDS
        )
      : undefined;

  const normalizedSteps = sanitizeSteps(input.steps);

  return {
    ...(typeof input.cronExpression === 'string' ? { cronExpression: input.cronExpression } : {}),
    ...(typeof input.timezone === 'string' ? { timezone: input.timezone } : {}),
    ...(normalizedSteps ? { steps: normalizedSteps } : {}),
    ...(normalizedStepInterval !== undefined
      ? { stepIntervalSeconds: normalizedStepInterval }
      : {}),
    ...(typeof input.sendFinalOpen === 'boolean' ? { sendFinalOpen: input.sendFinalOpen } : {}),
    ...(typeof input.enabled === 'boolean' ? { enabled: input.enabled } : {}),
  };
}

let redisInstance: Redis | null = null;

export function getRedis(): Redis | null {
  if (redisInstance) {
    return redisInstance;
  }

  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  redisInstance = new Redis({ url, token });
  return redisInstance;
}

/**
 * Retrieves the automation config from Redis with fallback to defaults.
 */
export async function getConfig(): Promise<AutomationConfig> {
  const redis = getRedis();
  if (!redis) {
    console.warn('Redis not configured. Returning DEFAULT_CONFIG.');
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = await redis.get<AutomationConfig | string>(KEY_CONFIG);
    if (!raw) {
      console.log('No config found in Redis. Initializing default config...');
      await updateConfig(DEFAULT_CONFIG);
      return { ...DEFAULT_CONFIG };
    }

    const dataObj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const normalized = normalizeConfig(dataObj as Record<string, unknown>);
    const merged = { ...DEFAULT_CONFIG, ...normalized };
    const safeConfig = applyRuntimeSafety(merged);

    return safeConfig;
  } catch (error) {
    console.error('Error reading config from Redis:', error);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Updates the automation config in Redis (supports partial updates).
 */
export async function updateConfig(updates: Partial<AutomationConfig>): Promise<AutomationConfig> {
  const redis = getRedis();
  const current = await getConfigRaw();
  const normalizedCurrent = normalizeConfig(current as Record<string, unknown>);
  const normalizedUpdates = normalizeConfig(updates as Record<string, unknown>);
  const newConfig = { ...DEFAULT_CONFIG, ...normalizedCurrent, ...normalizedUpdates };

  const safeConfig = applyRuntimeSafety(newConfig as AutomationConfig);

  if (redis) {
    await redis.set(KEY_CONFIG, safeConfig);
    console.log('Config updated in Redis:', JSON.stringify(safeConfig));
  }

  return safeConfig;
}

/**
 * Raw read without default merge.
 */
async function getConfigRaw(): Promise<Partial<AutomationConfig>> {
  const redis = getRedis();
  if (!redis) return {};

  try {
    const data = await redis.get<AutomationConfig | string>(KEY_CONFIG);
    if (!data) return {};
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch {
    return {};
  }
}

/**
 * Schedule state (for UI quick read and schedule API).
 */
export interface ScheduleState {
  schedule: string;
  timezone: string;
  state: 'ENABLED' | 'PAUSED' | string;
  scheduleId?: string;
  updatedAt?: string;
}

export async function getScheduleState(): Promise<ScheduleState> {
  const redis = getRedis();
  const config = await getConfig();

  if (!redis) {
    return {
      schedule: config.cronExpression,
      timezone: config.timezone,
      state: config.enabled ? 'ENABLED' : 'PAUSED',
    };
  }

  try {
    const state = await redis.get<ScheduleState | string>(KEY_SCHEDULE);
    if (!state) {
      return {
        schedule: config.cronExpression,
        timezone: config.timezone,
        state: config.enabled ? 'ENABLED' : 'PAUSED',
      };
    }
    return typeof state === 'string' ? JSON.parse(state) : state;
  } catch {
    return {
      schedule: config.cronExpression,
      timezone: config.timezone,
      state: config.enabled ? 'ENABLED' : 'PAUSED',
    };
  }
}

export async function setScheduleState(state: ScheduleState): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(KEY_SCHEDULE, state);
  } catch (error) {
    console.error('Error saving schedule state to Redis:', error);
  }
}

/**
 * Execution Status (`curtain:status`).
 */
export async function getExecutionStatus(): Promise<AutomationStatus> {
  const redis = getRedis();
  if (!redis) {
    return { state: 'idle' };
  }

  try {
    const status = await redis.get<AutomationStatus | string>(KEY_STATUS);
    if (!status) return { state: 'idle' };
    return typeof status === 'string' ? JSON.parse(status) : status;
  } catch (error) {
    console.error('Error getting execution status from Redis:', error);
    return { state: 'idle' };
  }
}

export async function setExecutionStatus(status: AutomationStatus): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(KEY_STATUS, {
      ...status,
      updatedAt: status.updatedAt || new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error setting execution status in Redis:', error);
  }
}

export async function cancelExecution(reason: string = 'User command'): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const current = await getExecutionStatus();
    await redis.set(KEY_STATUS, {
      ...current,
      state: 'cancelled',
      error: reason,
      updatedAt: new Date().toISOString(),
    });
    console.log(`Curtain automation marked cancelled: ${reason}`);
  } catch (error) {
    console.error('Error cancelling execution in Redis:', error);
  }
}

/**
 * Logs an execution result to Redis list (`LPUSH curtain:logs`) and trims to latest 200 logs.
 */
export async function appendLog(log: ExecutionLog): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    console.log('[Mock Log Entry]', JSON.stringify(log));
    return;
  }

  try {
    await redis.lpush(KEY_LOGS, JSON.stringify(log));
    await redis.ltrim(KEY_LOGS, 0, 199);
    console.log('Execution logged to Redis:', JSON.stringify(log));
  } catch (error) {
    console.error('Error logging execution to Redis:', error);
  }
}

/**
 * Returns recent execution logs (last N entries).
 */
export async function getRecentLogs(limit: number = 20): Promise<ExecutionLog[]> {
  const redis = getRedis();
  if (!redis) return [];

  try {
    const items = await redis.lrange<string | ExecutionLog>(KEY_LOGS, 0, limit - 1);
    return items.map((item) => {
      if (typeof item === 'string') {
        try {
          return JSON.parse(item) as ExecutionLog;
        } catch {
          return item as unknown as ExecutionLog;
        }
      }
      return item;
    });
  } catch (error) {
    console.error('Error reading logs from Redis:', error);
    return [];
  }
}
