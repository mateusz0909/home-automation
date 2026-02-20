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
      return { ...DEFAULT_CONFIG, ...data };
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

    await this.db.collection(COLLECTION).doc(CONFIG_DOC).set(newConfig);
    console.log('Config updated in Firestore:', JSON.stringify(newConfig));

    return newConfig;
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
        ? Math.max(5, Math.min(360, Math.round(stepIntervalCandidate)))
        : undefined;

    return {
      ...(typeof input.cronExpression === 'string' ? { cronExpression: input.cronExpression } : {}),
      ...(typeof input.timezone === 'string' ? { timezone: input.timezone } : {}),
      ...(Array.isArray(input.steps) ? { steps: input.steps as number[] } : {}),
      ...(normalizedStepInterval !== undefined
        ? { stepIntervalSeconds: normalizedStepInterval }
        : {}),
      ...(typeof input.sendFinalOpen === 'boolean' ? { sendFinalOpen: input.sendFinalOpen } : {}),
      ...(typeof input.enabled === 'boolean' ? { enabled: input.enabled } : {}),
    };
  }
}
