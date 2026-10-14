'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Clock, Calendar, Sliders, CheckCircle2, AlertCircle, RotateCcw, Sunrise } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Config {
  cronExpression: string;
  timezone: string;
  steps: number[];
  stepIntervalSeconds: number;
  sendFinalOpen: boolean;
  enabled: boolean;
}

const DURATION_PRESETS = [
  { label: '5s', value: 5 },
  { label: '10s', value: 10 },
  { label: '15s (Default)', value: 15 },
  { label: '30s', value: 30 },
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
];

const STEP_PRESETS = [
  { label: 'Gentle (7 steps)', steps: [10, 20, 35, 50, 65, 80, 90] },
  { label: 'Linear (9 steps)', steps: [10, 20, 30, 40, 50, 60, 70, 80, 90] },
  { label: 'Brisk (4 steps)', steps: [25, 50, 75, 90] },
];

function clampInterval(v: number): number {
  return Math.max(5, Math.min(360, Math.round(v)));
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

function parseStepsInput(input: string): number[] {
  return input
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n >= 0 && n <= 100)
    .sort((a, b) => a - b)
    .filter((n, idx, arr) => idx === 0 || n !== arr[idx - 1]);
}

const DAYS_OF_WEEK = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
];

const TIMEZONES = [
  'Europe/Warsaw',
  'Europe/Prague',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/London',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Amsterdam',
  'Europe/Zurich',
  'Europe/Vienna',
  'Europe/Stockholm',
  'Europe/Helsinki',
  'Europe/Athens',
  'US/Eastern',
  'US/Central',
  'US/Pacific',
  'UTC',
];

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

function buildCron(hour: number, minute: number, days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const dowPart =
    sorted.length === 7 || sorted.length === 0 ? '*' : sorted.join(',');
  return `${minute} ${hour} * * ${dowPart}`;
}

export default function ConfigPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Schedule fields
  const [scheduleHour, setScheduleHour] = useState(7);
  const [scheduleMinute, setScheduleMinute] = useState(0);
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [timezone, setTimezone] = useState('Europe/Warsaw');

  // Config fields
  const [stepsStr, setStepsStr] = useState('');
  const [stepInterval, setStepInterval] = useState(15);
  const [sendFinalOpen, setSendFinalOpen] = useState(true);
  const [enabled, setEnabled] = useState(true);

  // Auto-hide feedback after 4 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const fetchConfig = useCallback(async () => {
    try {
      setError('');
      const res = await fetch('/api/curtain/config');
      if (res.status === 401) {
        window.location.href = '/';
        return;
      }
      const data = await res.json();
      setConfig(data);

      const parsed = parseCron(data.cronExpression || '0 7 * * *');
      setScheduleHour(parsed.hour);
      setScheduleMinute(parsed.minute);
      setSelectedDays(parsed.days);
      setTimezone(data.timezone || 'Europe/Warsaw');

      setStepsStr((data.steps || []).join(', '));
      setStepInterval(data.stepIntervalSeconds ?? data.stepDelaySeconds ?? 15);
      setSendFinalOpen(data.sendFinalOpen ?? true);
      setEnabled(data.enabled ?? true);
    } catch {
      setError('Failed to load configuration parameters');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  function toggleDay(day: number) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function selectPreset(preset: 'everyday' | 'weekdays' | 'weekends') {
    if (preset === 'everyday') setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    else if (preset === 'weekdays') setSelectedDays([1, 2, 3, 4, 5]);
    else if (preset === 'weekends') setSelectedDays([0, 6]);
  }

  const isPresetActive = (preset: 'everyday' | 'weekdays' | 'weekends') => {
    const sorted = [...selectedDays].sort((a, b) => a - b);
    if (preset === 'everyday') return sorted.length === 7;
    if (preset === 'weekdays')
      return sorted.length === 5 && sorted.join(',') === '1,2,3,4,5';
    if (preset === 'weekends')
      return sorted.length === 2 && sorted.join(',') === '0,6';
    return false;
  };

  async function handleSaveSchedule() {
    setSavingSchedule(true);
    setError('');
    setSuccess('');

    if (selectedDays.length === 0) {
      setError('Select at least one active day of the week');
      setSavingSchedule(false);
      return;
    }

    const cronExpression = buildCron(scheduleHour, scheduleMinute, selectedDays);

    try {
      const res = await fetch('/api/curtain/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cronExpression, timezone }),
      });

      if (res.ok) {
        setSuccess('Schedule synced with QStash — effective immediately');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to update schedule');
      }
    } catch {
      setError('Network communication failure');
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleSaveConfig() {
    setSavingConfig(true);
    setError('');
    setSuccess('');

    const steps = parseStepsInput(stepsStr);

    const updates: Partial<Config> = {
      steps,
      stepIntervalSeconds: stepInterval,
      sendFinalOpen,
      enabled,
    };

    try {
      const res = await fetch('/api/curtain/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        setSuccess('Routine tuning parameters saved');
        await fetchConfig();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save configuration');
      }
    } catch {
      setError('Network communication failure');
    } finally {
      setSavingConfig(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="page-title">Schedule & Tuning</h2>
        <div className="panel-chassis h-64 w-full animate-pulse bg-card/60" />
      </div>
    );
  }

  const timeDisplay = `${String(scheduleHour).padStart(2, '0')}:${String(scheduleMinute).padStart(2, '0')}`;
  const parsedSteps = parseStepsInput(stepsStr);
  const totalRoutineSeconds = parsedSteps.length * stepInterval;
  const minutes = Math.floor(totalRoutineSeconds / 60);
  const seconds = totalRoutineSeconds % 60;
  const calculatedDuration = minutes > 0 ? `${minutes}m ${seconds > 0 ? `${seconds}s` : ''}` : `${seconds}s`;

  return (
    <div className="space-y-6">
      {/* Page Title & Reset */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Schedule & Routine Tuning</h2>
          <p className="text-xs font-mono text-muted-foreground pt-0.5">
            Configure circadian morning opening choreography and QStash automation
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchConfig}
          className="h-8 rounded-lg border-border/80 bg-secondary/50 text-xs font-mono text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Reload
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{success}</span>
        </div>
      )}

      {/* Global Master Switch */}
      <div className="panel-chassis flex items-center justify-between p-5">
        <div>
          <span className="text-sm font-semibold text-foreground">Global Automation Engine</span>
          <p className="text-xs text-muted-foreground pt-0.5">
            When disabled, all scheduled morning routines are temporarily suspended.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground">
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </div>

      {/* Schedule Configuration Card */}
      <div className="panel-chassis p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2 pb-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/80 bg-secondary/80 text-foreground">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Wake-Up Time & Cadence</h3>
            <p className="text-[11px] font-mono text-muted-foreground">
              QStash cron triggers
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Time Picker */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground">Scheduled Morning Time</Label>
            <Input
              type="time"
              className="h-11 font-mono text-lg tracking-wider border-border/80 bg-[#090b10] text-foreground focus-visible:ring-primary"
              value={timeDisplay}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number);
                if (!isNaN(h)) setScheduleHour(h);
                if (!isNaN(m)) setScheduleMinute(m);
              }}
            />
          </div>

          {/* Timezone Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground">Timezone (DST Handled)</Label>
            <select
              className="flex h-11 w-full rounded-md border border-border/80 bg-[#090b10] px-3 py-2 text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Days of Week Selection */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-foreground">Active Days</Label>
            <div className="flex gap-1.5">
              {(['everyday', 'weekdays', 'weekends'] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => selectPreset(preset)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1 text-[11px] font-mono transition-all',
                    isPresetActive(preset)
                      ? 'border-primary/50 bg-primary/20 text-primary font-medium'
                      : 'border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary'
                  )}
                >
                  {preset === 'everyday' ? 'Every day' : preset === 'weekdays' ? 'Weekdays' : 'Weekends'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {DAYS_OF_WEEK.map(({ label, value }) => {
              const active = selectedDays.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleDay(value)}
                  className={cn(
                    'flex h-10 items-center justify-center rounded-xl border text-xs font-mono transition-all',
                    active
                      ? 'border-primary bg-primary/15 text-primary font-semibold shadow-sm shadow-primary/10'
                      : 'border-border/60 bg-secondary/30 text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Schedule Summary Banner */}
        <div className="flex items-center justify-between rounded-xl border border-border/80 bg-[#090b10] p-3 text-xs font-mono text-muted-foreground">
          <span>
            Triggers at <span className="text-foreground font-semibold">{timeDisplay}</span> ({timezone})
          </span>
          <span className="text-[11px] text-primary/80">
            cron: {buildCron(scheduleHour, scheduleMinute, selectedDays)}
          </span>
        </div>

        <Button
          onClick={handleSaveSchedule}
          disabled={savingSchedule || selectedDays.length === 0}
          className="h-10 rounded-xl bg-primary text-primary-foreground font-medium text-xs sm:text-sm hover:bg-primary/90"
        >
          {savingSchedule ? 'Syncing with QStash...' : 'Save & Sync Schedule'}
        </Button>
      </div>

      {/* Sunrise Routine Step Choreography */}
      <div className="panel-chassis p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <Sunrise className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Sunrise Curve Choreography</h3>
              <p className="text-[11px] font-mono text-muted-foreground">
                Gradual stepped opening percentages & intervals
              </p>
            </div>
          </div>

          <div className="rounded-full border border-border/80 bg-secondary/60 px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
            ~{calculatedDuration} total routine
          </div>
        </div>

        {/* Step Presets */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-foreground">Step Presets</Label>
          </div>
          <div className="flex flex-wrap gap-2">
            {STEP_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setStepsStr(preset.steps.join(', '))}
                className="rounded-lg border border-border/70 bg-secondary/40 px-3 py-1.5 text-xs font-mono text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground transition-all"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Steps input */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground">
            Custom Step Percentages (0 to 100)
          </Label>
          <Input
            value={stepsStr}
            onChange={(e) => setStepsStr(e.target.value)}
            placeholder="10, 20, 35, 50, 65, 80, 90"
            className="h-10 font-mono text-sm border-border/80 bg-[#090b10] text-foreground focus-visible:ring-primary"
          />
          <p className="text-[11px] font-mono text-muted-foreground">
            Curtain moves sequentially through these target percentages.
          </p>
        </div>

        {/* Interval between steps */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-foreground">Interval Between Steps</Label>
            <span className="font-mono text-xs font-semibold text-primary">
              {formatDuration(stepInterval)}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {DURATION_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setStepInterval(p.value)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-mono transition-all',
                  stepInterval === p.value
                    ? 'border-primary bg-primary/15 text-primary font-semibold'
                    : 'border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Final Open Switch */}
        <div className="flex items-center justify-between rounded-xl border border-border/80 bg-[#090b10] p-3.5">
          <div>
            <span className="text-xs font-medium text-foreground">
              Send final 100% full-open impulse
            </span>
            <p className="text-[11px] font-mono text-muted-foreground pt-0.5">
              Ensures motor latches into the full mechanical limit stop after the last step.
            </p>
          </div>
          <Switch
            checked={sendFinalOpen}
            onCheckedChange={setSendFinalOpen}
            className="data-[state=checked]:bg-primary"
          />
        </div>

        <Button
          onClick={handleSaveConfig}
          disabled={savingConfig}
          className="h-10 rounded-xl bg-primary text-primary-foreground font-medium text-xs sm:text-sm hover:bg-primary/90"
        >
          {savingConfig ? 'Saving parameters...' : 'Save Routine Tuning'}
        </Button>
      </div>
    </div>
  );
}
