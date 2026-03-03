import * as ff from '@google-cloud/functions-framework';
import { TuyaClient } from './tuya-client';
import { ConfigService } from './config';
import { SchedulerService } from './scheduler';
import { runAutomation, runSingleStep } from './automation';
import {
  TriggerRequest,
  UpdateScheduleRequest,
  ExecutionLog,
  WorkflowExecutionLogRequest,
} from './types';

const configService = new ConfigService();
const schedulerService = new SchedulerService();

function getScheduledRunBudgetSeconds(): number {
  const raw = Number(process.env.SCHEDULED_RUN_BUDGET_SECONDS);
  if (Number.isFinite(raw) && raw >= 60 && raw <= 1700) {
    return Math.round(raw);
  }

  // Keep a safety margin below Cloud Scheduler's HTTP deadline.
  return 1500;
}

function parseTimestampToMillis(value: unknown): number {
  if (typeof value !== 'string' || value.length === 0) {
    return NaN;
  }

  const direct = Date.parse(value);
  if (Number.isFinite(direct)) {
    return direct;
  }

  // Workflows can emit RFC3339 with nanoseconds; JavaScript Date only accepts milliseconds.
  const normalized = value.replace(/\.(\d{3})\d+Z$/, '.$1Z');
  return Date.parse(normalized);
}

/**
 * Creates a TuyaClient from environment variables (loaded from Secret Manager).
 */
function createTuyaClient(): TuyaClient {
  const accessKey = process.env.TUYA_ACCESS_KEY;
  const secretKey = process.env.TUYA_ACCESS_SECRET;
  const deviceId = process.env.TUYA_DEVICE_ID;
  const region = process.env.TUYA_REGION || 'eu';

  if (!accessKey || !secretKey || !deviceId) {
    throw new Error(
      'Missing required environment variables: TUYA_ACCESS_KEY, TUYA_ACCESS_SECRET, TUYA_DEVICE_ID'
    );
  }

  return new TuyaClient({ accessKey, secretKey, deviceId, region });
}

/**
 * Main Cloud Function entry point.
 *
 * Routes:
 *   POST /              — Trigger the automation (used by Cloud Scheduler & manual trigger)
 *   GET  /status        — Get current device status
 *   GET  /config        — Get current automation config
 *   PUT  /config        — Update automation config
 *   GET  /logs          — Get recent execution logs
 */
ff.http('curtainAutomation', async (req: ff.Request, res: ff.Response) => {
  const path = req.path || '/';
  const method = req.method;

  try {
    // --- GET /status ---
    if (method === 'GET' && path === '/status') {
      const client = createTuyaClient();
      const position = await client.getDeviceStatus();
      res.json({ position, timestamp: new Date().toISOString() });
      return;
    }

    // --- GET /config ---
    if (method === 'GET' && path === '/config') {
      const config = await configService.getConfig();
      res.json(config);
      return;
    }

    // --- PUT /config ---
    if (method === 'PUT' && path === '/config') {
      const updates = req.body as UpdateScheduleRequest;
      const newConfig = await configService.updateConfig(updates);
      res.json({ message: 'Config updated', config: newConfig });
      return;
    }

    // --- GET /schedule ---
    if (method === 'GET' && path === '/schedule') {
      const schedule = await schedulerService.getSchedule();
      res.json(schedule);
      return;
    }

    // --- PUT /schedule ---
    if (method === 'PUT' && path === '/schedule') {
      const { cronExpression, timezone } = req.body as {
        cronExpression: string;
        timezone: string;
      };

      if (!cronExpression || !timezone) {
        res.status(400).json({ error: 'cronExpression and timezone are required' });
        return;
      }

      // Update both Firestore config AND Cloud Scheduler job
      await configService.updateConfig({ cronExpression, timezone });
      await schedulerService.updateSchedule(cronExpression, timezone);

      res.json({
        message: 'Schedule updated (Firestore + Cloud Scheduler)',
        cronExpression,
        timezone,
      });
      return;
    }

    // --- GET /logs ---
    if (method === 'GET' && path === '/logs') {
      const limit = parseInt(req.query.limit as string) || 10;
      const logs = await configService.getRecentLogs(limit);
      res.json({ logs });
      return;
    }

    // --- POST /command — Quick open/close/stop ---
    if (method === 'POST' && path === '/command') {
      const { command } = req.body as { command: string };

      if (!command || !['open', 'close', 'stop'].includes(command)) {
        res.status(400).json({ error: 'command must be one of: open, close, stop' });
        return;
      }

      const client = createTuyaClient();
      const success = await client.sendDirectionalCommand(command);

      // Wait a moment for the device to start moving, then read position
      await new Promise((r) => setTimeout(r, 1000));
      const position = await client.getDeviceStatus();

      res.json({
        message: success ? `Command '${command}' sent successfully` : `Command '${command}' failed`,
        success,
        command,
        position,
      });
      return;
    }

    // --- POST /step — Execute one target percentage step (workflow-friendly) ---
    if (method === 'POST' && path === '/step') {
      const { targetPercent } = req.body as { targetPercent: number };

      if (typeof targetPercent !== 'number' || Number.isNaN(targetPercent)) {
        res.status(400).json({ error: 'targetPercent (number) is required' });
        return;
      }

      const config = await configService.getConfig();
      const client = createTuyaClient();
      const result = await runSingleStep(
        client,
        targetPercent,
        config.stepIntervalSeconds
      );

      res.status(result.success ? 200 : 500).json(result);
      return;
    }

    // --- POST /workflow/log — Persist workflow execution summary ---
    if (method === 'POST' && path === '/workflow/log') {
      const body = (req.body || {}) as WorkflowExecutionLogRequest;

      const startedAtMs = parseTimestampToMillis(body.startedAt);
      const durationMs = Number.isFinite(startedAtMs)
        ? Math.max(0, Date.now() - startedAtMs)
        : 0;

      const log: ExecutionLog = {
        timestamp: new Date().toISOString(),
        trigger: 'scheduled',
        success: Boolean(body.success),
        stepsCompleted:
          typeof body.stepsCompleted === 'number'
            ? Math.max(0, Math.round(body.stepsCompleted))
            : 0,
        totalSteps:
          typeof body.totalSteps === 'number'
            ? Math.max(0, Math.round(body.totalSteps))
            : 0,
        finalPosition:
          typeof body.finalPosition === 'number'
            ? Math.max(0, Math.min(100, Math.round(body.finalPosition)))
            : null,
        durationMs,
        ...(body.error ? { error: String(body.error) } : {}),
      };

      await configService.logExecution(log);
      res.json({ message: 'Workflow execution logged', log });
      return;
    }

    // --- POST / — Trigger automation ---
    if (method === 'POST' && (path === '/' || path === '/trigger')) {
      const body = (req.body || {}) as TriggerRequest;
      const config = await configService.getConfig();

      if (!config.enabled && !body.force) {
        console.log('Automation is disabled. Use force=true to override.');
        res.status(200).json({
          message: 'Automation is disabled',
          hint: 'Set enabled=true in config or pass force=true in request body',
        });
        return;
      }

      // Allow step override from request body
      if (body.steps && body.steps.length > 0) {
        config.steps = body.steps;
      }

      const startTime = Date.now();
      const client = createTuyaClient();
      const isScheduled = Boolean(req.headers['x-cloudscheduler']);
      const result = await runAutomation(client, config, {
        maxTotalDurationSeconds: isScheduled
          ? getScheduledRunBudgetSeconds()
          : undefined,
      });
      const durationMs = Date.now() - startTime;

      // Log execution
      const trigger: 'scheduled' | 'manual' = isScheduled ? 'scheduled' : 'manual';

      const log: ExecutionLog = {
        timestamp: new Date().toISOString(),
        trigger,
        success: result.success,
        stepsCompleted: result.stepsCompleted,
        totalSteps: result.totalSteps,
        finalPosition: result.finalPosition,
        durationMs,
        ...(result.error && { error: result.error }),
      };

      await configService.logExecution(log);

      res.status(result.success ? 200 : 500).json({
        message: result.success ? 'Automation completed successfully' : 'Automation failed',
        ...result,
        durationMs,
        trigger,
      });
      return;
    }

    // --- Fallback ---
    res.status(404).json({
      error: 'Not found',
      availableRoutes: {
        'POST /': 'Trigger the curtain automation',
        'POST /trigger': 'Trigger the curtain automation (alias)',
        'POST /command': 'Send quick command (open/close/stop)',
        'POST /step': 'Execute one step toward targetPercent (workflow use)',
        'POST /workflow/log': 'Persist workflow execution summary',
        'GET /status': 'Get current curtain position',
        'GET /config': 'Get automation config',
        'PUT /config': 'Update automation config',
        'GET /schedule': 'Get current Cloud Scheduler schedule',
        'PUT /schedule': 'Update schedule (Firestore + Cloud Scheduler)',
        'GET /logs': 'Get recent execution logs',
      },
    });
  } catch (error) {
    console.error('Unhandled error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
