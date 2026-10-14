import { TuyaContext } from '@tuya/tuya-connector-nodejs';
import { TuyaStatusEntry } from './types';

/** Regional base URLs for Tuya Cloud API */
const REGION_URLS: Record<string, string> = {
  eu: 'https://openapi.tuyaeu.com',
  us: 'https://openapi.tuyaus.com',
  cn: 'https://openapi.tuyacn.com',
  in: 'https://openapi.tuyain.com',
};

/** Retry configuration for transient failures */
const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 5000,
};

/**
 * Sleep for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exponential backoff with jitter for retries.
 */
function getBackoffDelayMs(attempt: number): number {
  const exponential = Math.min(
    RETRY_CONFIG.maxDelayMs,
    RETRY_CONFIG.initialDelayMs * Math.pow(2, attempt - 1)
  );
  const jitter = exponential * 0.1 * Math.random();
  return exponential + jitter;
}

/**
 * Determines if an error is retryable.
 */
function isRetryableError(error: unknown, statusCode?: number): boolean {
  // Retry on 429 (rate limit) and 5xx (server errors)
  if (statusCode === 429 || (statusCode !== undefined && statusCode >= 500)) {
    return true;
  }

  // Retry on network timeouts and connection errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('enetunreach')
    ) {
      return true;
    }
  }

  return false;
}

export class TuyaClient {
  private tuya: TuyaContext;
  private deviceId: string;

  constructor(config: {
    accessKey: string;
    secretKey: string;
    deviceId: string;
    region: string;
  }) {
    const baseUrl = REGION_URLS[config.region] || REGION_URLS.eu;
    this.deviceId = config.deviceId;

    this.tuya = new TuyaContext({
      baseUrl,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });
  }

  /**
   * Gets the current percent_state of the curtain device.
   * Returns the percentage (0-100) or null if unavailable.
   *
   * Implements automatic retry with exponential backoff for transient failures.
   */
  async getDeviceStatus(): Promise<number | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
      try {
        const response = (await this.tuya.request({
          method: 'GET',
          path: `/v1.0/devices/${this.deviceId}/status`,
        })) as any;

        // Extract result from wrapper or direct response
        const data = response?.result || response;
        const success = data?.success ?? response?.success;
        const result = data?.result ?? response?.result;

        if (success && Array.isArray(result)) {
          const percentState = result.find(
            (s: TuyaStatusEntry) => s.code === 'percent_state'
          );
          if (percentState !== undefined) {
            const percent = Number(percentState.value);
            if (Number.isFinite(percent) && percent >= 0 && percent <= 100) {
              return percent;
            }
          }
        }

        console.warn(
          `[Attempt ${attempt}/${RETRY_CONFIG.maxAttempts}] Could not find percent_state in device status:`,
          JSON.stringify(response)
        );
        lastError = new Error('percent_state not found in response');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(
          `[Attempt ${attempt}/${RETRY_CONFIG.maxAttempts}] Error getting device status:`,
          lastError.message
        );

        // If this is the last attempt or error is not retryable, return null
        if (attempt === RETRY_CONFIG.maxAttempts || !isRetryableError(error)) {
          return null;
        }

        // Wait before retrying
        const delayMs = getBackoffDelayMs(attempt);
        console.log(`Retrying in ${delayMs.toFixed(0)}ms...`);
        await sleep(delayMs);
      }
    }

    return null;
  }

  /**
   * Sends a percent_control command to set the curtain to a specific position.
   *
   * Implements automatic retry with exponential backoff for transient failures.
   */
  async setDevicePercent(percent: number): Promise<boolean> {
    const now = new Date().toISOString();
    console.log(`[${now}] Sending command: percent_control = ${percent}%`);

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
      try {
        const response = (await this.tuya.request({
          method: 'POST',
          path: `/v1.0/devices/${this.deviceId}/commands`,
          body: {
            commands: [{ code: 'percent_control', value: percent }],
          },
        })) as any;

        const data = response?.result || response;
        const success = data?.success ?? response?.success;
        const result = data?.result ?? response?.result;

        console.log(
          `[Attempt ${attempt}/${RETRY_CONFIG.maxAttempts}] Command result: success=${success}, result=${result}`
        );

        if (success === true && result === true) {
          return true;
        }

        // Check if error is retryable before giving up
        if (attempt < RETRY_CONFIG.maxAttempts && isRetryableError(null, response?.code)) {
          const delayMs = getBackoffDelayMs(attempt);
          console.log(`Retrying in ${delayMs.toFixed(0)}ms...`);
          await sleep(delayMs);
          continue;
        }

        console.error('Tuya API Error Response:', JSON.stringify(response));
        return false;
      } catch (error) {
        console.error(
          `[Attempt ${attempt}/${RETRY_CONFIG.maxAttempts}] Error sending percent command:`,
          error
        );

        // If this is the last attempt or error is not retryable, return false
        if (attempt === RETRY_CONFIG.maxAttempts || !isRetryableError(error)) {
          return false;
        }

        // Wait before retrying
        const delayMs = getBackoffDelayMs(attempt);
        console.log(`Retrying in ${delayMs.toFixed(0)}ms...`);
        await sleep(delayMs);
      }
    }

    return false;
  }

  /**
   * Sends a directional control command (e.g., 'open', 'close', 'stop').
   *
   * Implements automatic retry with exponential backoff for transient failures.
   */
  async sendDirectionalCommand(command: string): Promise<boolean> {
    const now = new Date().toISOString();
    console.log(`[${now}] Sending directional command: control = '${command}'`);

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
      try {
        const response = (await this.tuya.request({
          method: 'POST',
          path: `/v1.0/devices/${this.deviceId}/commands`,
          body: {
            commands: [{ code: 'control', value: command }],
          },
        })) as any;

        const data = response?.result || response;
        const success = data?.success ?? response?.success;
        const result = data?.result ?? response?.result;

        console.log(
          `[Attempt ${attempt}/${RETRY_CONFIG.maxAttempts}] Command result: success=${success}, result=${result}`
        );

        if (success === true && result === true) {
          return true;
        }

        // Check if error is retryable before giving up
        if (attempt < RETRY_CONFIG.maxAttempts && isRetryableError(null, response?.code)) {
          const delayMs = getBackoffDelayMs(attempt);
          console.log(`Retrying in ${delayMs.toFixed(0)}ms...`);
          await sleep(delayMs);
          continue;
        }

        console.error('Tuya API Error Response:', JSON.stringify(response));
        return false;
      } catch (error) {
        console.error(
          `[Attempt ${attempt}/${RETRY_CONFIG.maxAttempts}] Error sending directional command:`,
          error
        );

        // If this is the last attempt or error is not retryable, return false
        if (attempt === RETRY_CONFIG.maxAttempts || !isRetryableError(error)) {
          return false;
        }

        // Wait before retrying
        const delayMs = getBackoffDelayMs(attempt);
        console.log(`Retrying in ${delayMs.toFixed(0)}ms...`);
        await sleep(delayMs);
      }
    }

    return false;
  }
}

/**
 * Creates or retrieves a TuyaClient using environment variables.
 * Supports TUYA_ACCESS_ID or TUYA_ACCESS_KEY, TUYA_ENDPOINT or TUYA_REGION.
 */
export function getTuyaClient(): TuyaClient {
  const accessKey =
    process.env.TUYA_ACCESS_KEY ||
    process.env.TUYA_ACCESS_ID ||
    process.env.TUYA_CLIENT_ID;
  const secretKey =
    process.env.TUYA_ACCESS_SECRET ||
    process.env.TUYA_SECRET_KEY;
  const deviceId =
    process.env.TUYA_DEVICE_ID;
  const rawRegion =
    process.env.TUYA_REGION ||
    process.env.TUYA_ENDPOINT ||
    'eu';

  if (!accessKey || !secretKey || !deviceId) {
    throw new Error(
      'Missing required Tuya environment variables: TUYA_ACCESS_ID (or TUYA_ACCESS_KEY), TUYA_ACCESS_SECRET, and TUYA_DEVICE_ID'
    );
  }

  // Parse region if provided as full URL or short code
  let region = rawRegion.toLowerCase().trim();
  for (const [code, url] of Object.entries(REGION_URLS)) {
    if (region.includes(code) || region === url) {
      region = code;
      break;
    }
  }

  return new TuyaClient({ accessKey, secretKey, deviceId, region });
}
