'use client';

import { useState, useEffect, useCallback } from 'react';
import { CurtainStage } from '@/components/dashboard/CurtainStage';
import { SunriseRoutineCard } from '@/components/dashboard/SunriseRoutineCard';
import { ScheduleSummaryCard } from '@/components/dashboard/ScheduleSummaryCard';
import { RecentActivityCard, LogEntry } from '@/components/dashboard/RecentActivityCard';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface StatusData {
  position: number | null;
  timestamp: string;
}

interface CommandResult {
  message: string;
  success: boolean;
  command?: string;
  position?: number | null;
  stepsCompleted?: number;
  totalSteps?: number;
  finalPosition?: number | null;
  durationMs?: number;
  error?: string;
}

interface ConfigData {
  cronExpression: string;
  timezone: string;
  steps: number[];
  stepIntervalSeconds: number;
  sendFinalOpen: boolean;
  enabled: boolean;
}

function parseCron(cron: string): { hour: number; minute: number; days: number[] } {
  const parts = cron.trim().split(/\s+/);
  const minute = parseInt(parts[0], 10) || 0;
  const hour = parseInt(parts[1], 10) || 7;
  const dowPart = parts[4] || '*';

  let days: number[];
  if (dowPart === '*') {
    days = [0, 1, 2, 3, 4, 5, 6];
  } else {
    days = dowPart
      .split(',')
      .flatMap((seg) => {
        if (seg.includes('-')) {
          const [start, end] = seg.split('-').map(Number);
          const result: number[] = [];
          for (let i = start; i <= end; i++) result.push(i);
          return result;
        }
        return [parseInt(seg, 10)];
      })
      .filter((n) => !isNaN(n));
  }

  return { hour, minute, days };
}

export default function DashboardPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [commandFeedback, setCommandFeedback] = useState<{ message: string; success: boolean } | null>(null);
  const [error, setError] = useState('');

  // Auto-hide feedback after 4 seconds
  useEffect(() => {
    if (commandFeedback) {
      const timer = setTimeout(() => setCommandFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [commandFeedback]);

  const fetchStatus = useCallback(async () => {
    try {
      setError('');
      const res = await fetch('/api/curtain/status');
      if (res.status === 401) {
        window.location.href = '/';
        return;
      }
      const data = await res.json();
      setStatus(data);
    } catch {
      setError('Unable to read device status from Tuya Cloud');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/curtain/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/curtain/logs?limit=5');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchConfig();
    fetchLogs();

    const interval = setInterval(() => {
      fetchStatus();
      fetchLogs();
    }, 20000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchConfig, fetchLogs]);

  async function handleCommand(command: 'open' | 'close' | 'stop') {
    setActiveCommand(command);
    setCommandFeedback(null);

    try {
      const res = await fetch('/api/curtain/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      const data: CommandResult = await res.json();
      setCommandFeedback({
        message: data.message || `Command ${command} executed`,
        success: data.success,
      });
      await fetchStatus();
      await fetchLogs();
    } catch {
      setCommandFeedback({
        message: 'Network communication failure',
        success: false,
      });
    } finally {
      setActiveCommand(null);
    }
  }

  async function handleSetPercent(percent: number) {
    setActiveCommand(`percent:${percent}`);
    setCommandFeedback(null);

    try {
      const res = await fetch('/api/curtain/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percent }),
      });
      const data: CommandResult = await res.json();
      setCommandFeedback({
        message: data.message || `Set position to ${percent}%`,
        success: data.success,
      });
      await fetchStatus();
      await fetchLogs();
    } catch {
      setCommandFeedback({
        message: 'Network communication failure',
        success: false,
      });
    } finally {
      setActiveCommand(null);
    }
  }

  async function handleGradualOpen() {
    setActiveCommand('gradual');
    setCommandFeedback(null);

    try {
      const res = await fetch('/api/curtain/trigger', { method: 'POST' });
      const data = await res.json();
      setCommandFeedback({
        message: data.message || 'Sunrise routine initiated',
        success: data.success ?? true,
      });
      await fetchStatus();
      await fetchLogs();
    } catch {
      setCommandFeedback({
        message: 'Could not trigger sunrise routine',
        success: false,
      });
    } finally {
      setActiveCommand(null);
    }
  }

  async function handleToggleEnabled(enabled: boolean) {
    try {
      const res = await fetch('/api/curtain/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        setConfig((prev) => (prev ? { ...prev, enabled } : null));
        setCommandFeedback({
          message: enabled ? 'Automation schedule enabled' : 'Automation schedule suspended',
          success: true,
        });
      }
    } catch {
      setCommandFeedback({
        message: 'Failed to update schedule status',
        success: false,
      });
    }
  }

  const parsedCron = config?.cronExpression
    ? parseCron(config.cronExpression)
    : { hour: 7, minute: 0, days: [1, 2, 3, 4, 5] };

  const scheduleTimeDisplay = `${String(parsedCron.hour).padStart(2, '0')}:${String(
    parsedCron.minute
  ).padStart(2, '0')}`;

  const position = status?.position ?? null;
  const isOpen = position !== null && position >= 100;

  return (
    <div className="space-y-6">
      {/* Dynamic Feedback Toast / Alert Banner */}
      {commandFeedback && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition-all shadow-lg animate-in fade-in slide-in-from-top-2 ${
            commandFeedback.success
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {commandFeedback.success ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            )}
            <span className="font-medium text-xs sm:text-sm">{commandFeedback.message}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs sm:text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Hero: Physical Curtain Stage */}
      <CurtainStage
        position={position}
        loading={loading}
        activeCommand={activeCommand}
        onCommand={handleCommand}
        onSetPercent={handleSetPercent}
        onRefresh={fetchStatus}
      />

      {/* Second Row: Circadian Routine & Schedule Overview */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <SunriseRoutineCard
          activeCommand={activeCommand}
          isOpen={isOpen}
          steps={config?.steps ?? [10, 25, 45, 70, 90]}
          intervalSeconds={config?.stepIntervalSeconds ?? 15}
          onTrigger={handleGradualOpen}
          onStop={() => handleCommand('stop')}
        />

        <ScheduleSummaryCard
          timeStr={scheduleTimeDisplay}
          days={parsedCron.days}
          timezone={config?.timezone ?? 'Europe/Prague'}
          enabled={config?.enabled ?? true}
          onToggleEnabled={handleToggleEnabled}
        />
      </div>

      {/* Third Row: Recent Activity Telemetry Stream */}
      <RecentActivityCard logs={logs} loading={loading} />
    </div>
  );
}
