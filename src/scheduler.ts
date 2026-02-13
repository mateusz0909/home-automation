import { CloudSchedulerClient } from '@google-cloud/scheduler';

/**
 * Service for programmatically updating the Cloud Scheduler job.
 * This allows the frontend to change the schedule without redeployment.
 */
export class SchedulerService {
  private client: CloudSchedulerClient;
  private projectId: string;
  private location: string;
  private jobName: string;

  constructor() {
    this.client = new CloudSchedulerClient();
    this.projectId =
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCP_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      'home-automation-487308';
    this.location = process.env.FUNCTION_REGION || 'us-central1';
    this.jobName = 'curtain-daily-open';
  }

  private getJobPath(): string {
    return `projects/${this.projectId}/locations/${this.location}/jobs/${this.jobName}`;
  }

  /**
   * Updates the Cloud Scheduler job's schedule and timezone.
   * Only modifies the schedule and timeZone fields, leaving the target URL intact.
   */
  async updateSchedule(cronExpression: string, timezone: string): Promise<void> {
    const jobPath = this.getJobPath();
    console.log(`Updating Cloud Scheduler job: ${jobPath}`);
    console.log(`  schedule: ${cronExpression}`);
    console.log(`  timezone: ${timezone}`);

    await this.client.updateJob({
      job: {
        name: jobPath,
        schedule: cronExpression,
        timeZone: timezone,
      },
      updateMask: {
        paths: ['schedule', 'time_zone'],
      },
    });

    console.log('Cloud Scheduler job updated successfully');
  }

  /**
   * Reads the current schedule from the Cloud Scheduler job.
   */
  async getSchedule(): Promise<{ schedule: string; timezone: string; state: string }> {
    const jobPath = this.getJobPath();
    const [job] = await this.client.getJob({ name: jobPath });

    return {
      schedule: job.schedule || '0 7 * * *',
      timezone: job.timeZone || 'Europe/Prague',
      state: String(job.state ?? 'ENABLED'),
    };
  }
}
