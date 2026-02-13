import { TuyaContext } from '@tuya/tuya-connector-nodejs';
import { TuyaStatusEntry } from './types';

/** Regional base URLs for Tuya Cloud API */
const REGION_URLS: Record<string, string> = {
  eu: 'https://openapi.tuyaeu.com',
  us: 'https://openapi.tuyaus.com',
  cn: 'https://openapi.tuyacn.com',
  in: 'https://openapi.tuyain.com',
};

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
   */
  async getDeviceStatus(): Promise<number | null> {
    try {
      const response = await this.tuya.request({
        method: 'GET',
        path: `/v1.0/devices/${this.deviceId}/status`,
      }) as any;

      const data = response?.result || response;
      const success = data?.success ?? response?.success;
      const result = data?.result ?? response?.result;

      if (success && Array.isArray(result)) {
        const percentState = result.find(
          (s: TuyaStatusEntry) => s.code === 'percent_state'
        );
        if (percentState !== undefined) {
          return Number(percentState.value);
        }
      }

      console.warn('Could not find percent_state in device status:', JSON.stringify(response));
      return null;
    } catch (error) {
      console.error('Error getting device status:', error);
      return null;
    }
  }

  /**
   * Sends a percent_control command to set the curtain to a specific position.
   */
  async setDevicePercent(percent: number): Promise<boolean> {
    const now = new Date().toISOString();
    console.log(`[${now}] Sending command: percent_control = ${percent}%`);

    try {
      const response = await this.tuya.request({
        method: 'POST',
        path: `/v1.0/devices/${this.deviceId}/commands`,
        body: {
          commands: [{ code: 'percent_control', value: percent }],
        },
      }) as any;

      const success = response?.result?.success ?? response?.success;
      const result = response?.result?.result ?? response?.result;
      console.log(`Command result: success=${success}, result=${result}`);
      return success === true && result === true;
    } catch (error) {
      console.error('Error sending percent command:', error);
      return false;
    }
  }

  /**
   * Sends a directional control command (e.g., 'open', 'close', 'stop').
   */
  async sendDirectionalCommand(command: string): Promise<boolean> {
    const now = new Date().toISOString();
    console.log(`[${now}] Sending directional command: control = '${command}'`);

    try {
      const response = await this.tuya.request({
        method: 'POST',
        path: `/v1.0/devices/${this.deviceId}/commands`,
        body: {
          commands: [{ code: 'control', value: command }],
        },
      }) as any;

      const success = response?.result?.success ?? response?.success;
      const result = response?.result?.result ?? response?.result;
      console.log(`Command result: success=${success}, result=${result}`);
      return success === true && result === true;
    } catch (error) {
      console.error('Error sending directional command:', error);
      return false;
    }
  }
}
