import { Firestore } from '@google-cloud/firestore';
import { AutomationConfig, ExecutionLog } from './types';

/** Default configuration used when no Firestore document exists yet */
const DEFAULT_CONFIG: AutomationConfig = {
  cronExpression: '0 7 * * *',
  timezone: 'Europe/Prague',
  steps: [10, 20, 30, 40, 50, 60, 70, 80, 90],
  stepIntervalSeconds: 15,
  sendFinalOpen: true,
  enabled: true,
};

const COLLECTION = 'curtain-automation';
const CONFIG_DOC = 'config';
const LOGS_COLLECTION = 'execution-logs';

const MIN_STEP_INTERVAL_SECONDS = 5;
const MAX_STEP_INTERVAL_SECONDS = 360;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

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

export class ConfigService {
  private db: Firestore;

  constructor() {
    // In GCP, Firestore auto-discovers the project from the environment
    this.db = new Firestore();
  }

  /**
   * Retrieves the automation config from Firestore.
   * Creates a default document if none exists.
   */
  async getConfig(): Promise<AutomationConfig> {
    try {
      const doc = await this.db.collection(COLLECTION).doc(CONFIG_DOC).get();

      if (!doc.exists) {
        console.log('No config found in Firestore. Creating default config...');
        await this.updateConfig(DEFAULT_CONFIG);
        return { ...DEFAULT_CONFIG };
      }

      const data = this.normalizeConfig(doc.data() as Record<string, unknown>);
      // Merge with defaults to fill any missing fields
      const merged = { ...DEFAULT_CONFIG, ...data };
      const safeConfig = applyRuntimeSafety(merged);

      if (
        safeConfig.stepIntervalSeconds !== merged.stepIntervalSeconds ||
        JSON.stringify(safeConfig.steps) !== JSON.stringify(merged.steps)
      ) {
        await this.db.collection(COLLECTION).doc(CONFIG_DOC).set(safeConfig);
        console.warn('Stored config was adjusted to runtime-safe values.');
      }

      return safeConfig;
    } catch (error) {
      console.error('Error reading config from Firestore:', error);
      console.log('Falling back to default config');
      return { ...DEFAULT_CONFIG };
    }
  }

  /**
   * Updates the automation config in Firestore (partial update supported).
   */
  async updateConfig(updates: Partial<AutomationConfig>): Promise<AutomationConfig> {
    const currentConfig = await this.getConfigRaw();
    const normalizedCurrent = this.normalizeConfig(currentConfig as Record<string, unknown>);
    const normalizedUpdates = this.normalizeConfig(updates as Record<string, unknown>);
    const newConfig = { ...DEFAULT_CONFIG, ...normalizedCurrent, ...normalizedUpdates };

    const requestedInterval =
      typeof newConfig.stepIntervalSeconds === 'number'
        ? newConfig.stepIntervalSeconds
        : DEFAULT_CONFIG.stepIntervalSeconds;
    const safeConfig = applyRuntimeSafety(newConfig as AutomationConfig);

    if (requestedInterval > MAX_STEP_INTERVAL_SECONDS) {
      console.warn(
        `stepIntervalSeconds ${requestedInterval}s is too high; clamped to ${MAX_STEP_INTERVAL_SECONDS}s.`
      );
    }

    await this.db.collection(COLLECTION).doc(CONFIG_DOC).set(safeConfig);
    console.log('Config updated in Firestore:', JSON.stringify(safeConfig));

    return safeConfig;
  }

  /**
   * Logs an execution result to Firestore for history tracking.
   */
  async logExecution(log: ExecutionLog): Promise<void> {
    try {
      await this.db
        .collection(COLLECTION)
        .doc(CONFIG_DOC)
        .collection(LOGS_COLLECTION)
        .add(log);
      console.log('Execution logged:', JSON.stringify(log));
    } catch (error) {
      console.error('Error logging execution:', error);
    }
  }

  /**
   * Returns recent execution logs (last N entries).
   */
  async getRecentLogs(limit: number = 10): Promise<ExecutionLog[]> {
    try {
      const snapshot = await this.db
        .collection(COLLECTION)
        .doc(CONFIG_DOC)
        .collection(LOGS_COLLECTION)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc) => doc.data() as ExecutionLog);
    } catch (error) {
      console.error('Error reading logs:', error);
      return [];
    }
  }

  /** Raw read without default merge — used internally */
  private async getConfigRaw(): Promise<Partial<AutomationConfig>> {
    try {
      const doc = await this.db.collection(COLLECTION).doc(CONFIG_DOC).get();
      return doc.exists ? (doc.data() as Partial<AutomationConfig>) : {};
    } catch {
      return {};
    }
  }

  private normalizeConfig(input: Record<string, unknown>): Partial<AutomationConfig> {
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
}
