'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

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
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
];

function clampInterval(v: number): number {
  return Math.max(5, Math.min(600, Math.round(v)));
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
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
  'Europe/Prague',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Amsterdam',
  'Europe/Warsaw',
  'Europe/Zurich',
  'Europe/Vienna',
  'Europe/Stockholm',
  'Europe/Helsinki',
  'Europe/Athens',
  'Europe/Bucharest',
  'Europe/Istanbul',
  'US/Eastern',
  'US/Central',
  'US/Mountain',
  'US/Pacific',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'UTC',
];

/** Parse a cron expression "M H * * DOW" into time + selected days */
function parseCron(cron: string): { hour: number; minute: number; days: number[] } {
  const parts = cron.trim().split(/\s+/);
  const minute = parseInt(parts[0]) || 0;
  const hour = parseInt(parts[1]) || 7;
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
        return [parseInt(seg)];
      })
      .filter((n) => !isNaN(n));
  }

  return { hour, minute, days };
}

/** Build a cron expression from time + selected days */
function buildCron(hour: number, minute: number, days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const dowPart =
    sorted.length === 7 || sorted.length === 0 ? '*' : sorted.join(',');
  return `${minute} ${hour} * * ${dowPart}`;
}

export default function ConfigPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Schedule fields
  const [scheduleHour, setScheduleHour] = useState(7);
  const [scheduleMinute, setScheduleMinute] = useState(0);
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [timezone, setTimezone] = useState('Europe/Prague');

  // Config fields
  const [stepsStr, setStepsStr] = useState('');
  const [stepInterval, setStepInterval] = useState(15);
  const [sendFinalOpen, setSendFinalOpen] = useState(true);
  const [enabled, setEnabled] = useState(true);

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

      // Parse cron into friendly fields
      const parsed = parseCron(data.cronExpression || '0 7 * * *');
      setScheduleHour(parsed.hour);
      setScheduleMinute(parsed.minute);
      setSelectedDays(parsed.days);
      setTimezone(data.timezone || 'Europe/Prague');

      setStepsStr((data.steps || []).join(', '));
      setStepInterval(data.stepIntervalSeconds ?? data.stepDelaySeconds ?? 15);
      setSendFinalOpen(data.sendFinalOpen ?? true);
      setEnabled(data.enabled ?? true);
    } catch {
      setError('Failed to load config');
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

  /** Save schedule — updates both Firestore config AND Cloud Scheduler job */
  async function handleSaveSchedule() {
    setSavingSchedule(true);
    setError('');
    setSuccess('');

    if (selectedDays.length === 0) {
      setError('Please select at least one day');
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
        setSuccess('Schedule updated — takes effect immediately');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to update schedule');
      }
    } catch {
      setError('Network error');
    } finally {
      setSavingSchedule(false);
    }
  }

  /** Save other config fields (steps, timing, toggles) */
  async function handleSaveConfig() {
    setSaving(true);
    setError('');
    setSuccess('');

    const steps = stepsStr
      .split(',')
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n) && n >= 0 && n <= 100);

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
        setSuccess('Configuration saved successfully');
        await fetchConfig();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save config');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="page-title">Configuration</h2>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="h-40 w-full animate-pulse rounded-md bg-muted" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const timeDisplay = `${String(scheduleHour).padStart(2, '0')}:${String(scheduleMinute).padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="page-title">Configuration</h2>
        <Button variant="outline" onClick={fetchConfig}>
          Reset
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          {success}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Automation Enabled</CardTitle>
          <CardDescription>When disabled, scheduled triggers will be skipped.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Enable or disable the scheduler globally.</p>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Schedule</CardTitle>
          <CardDescription>Configure run time, timezone and active weekdays.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Open curtains at</Label>
            <Input
              type="time"
              className="w-full sm:w-[200px]"
              value={timeDisplay}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number);
                if (!isNaN(h)) setScheduleHour(h);
                if (!isNaN(m)) setScheduleMinute(m);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Repeat on</Label>
            <div className="flex flex-wrap gap-2">
              {(['everyday', 'weekdays', 'weekends'] as const).map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={isPresetActive(preset) ? 'default' : 'outline'}
                  onClick={() => selectPreset(preset)}
                >
                  {preset === 'everyday' ? 'Every day' : preset === 'weekdays' ? 'Weekdays' : 'Weekends'}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {DAYS_OF_WEEK.map(({ label, value }) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={selectedDays.includes(value) ? 'default' : 'outline'}
                  className="w-12"
                  onClick={() => toggleDay(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Timezone</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-xs"
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

          <div className="rounded-lg border border-border/80 bg-muted/35 p-3 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Preview:</span>{' '}
              {selectedDays.length === 7
                ? 'Every day'
                : selectedDays.length === 0
                  ? 'No days selected'
                  : DAYS_OF_WEEK.filter((d) => selectedDays.includes(d.value))
                      .map((d) => d.label)
                      .join(', ')}{' '}
              at {timeDisplay} ({timezone})
            </p>
            <p className="mt-1 font-mono text-xs">cron: {buildCron(scheduleHour, scheduleMinute, selectedDays)}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleSaveSchedule}
              disabled={savingSchedule || selectedDays.length === 0}
            >
              {savingSchedule ? 'Updating...' : 'Update Schedule'}
            </Button>
            <span className="text-xs text-muted-foreground">Takes effect immediately</span>
          </div>

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Opening Steps</CardTitle>
          <CardDescription>Define gradual opening percentages and final command behavior.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Percentage steps (comma-separated)</Label>
            <Input
              value={stepsStr}
              onChange={(e) => setStepsStr(e.target.value)}
              placeholder="10, 20, 30, 40, 50, 60, 70, 80, 90"
            />
            <p className="text-xs text-muted-foreground">The curtain opens gradually through these positions.</p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 p-3">
            <div>
              <p className="text-sm font-medium">Send final "open" command</p>
              <p className="text-xs text-muted-foreground">After the last step, send explicit open command to reach 100%.</p>
            </div>
            <Switch checked={sendFinalOpen} onCheckedChange={setSendFinalOpen} />
          </div>

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timing</CardTitle>
          <CardDescription>
            Set the interval between opening steps. Maximum is 10 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>Interval between steps</Label>

            {/* MM : SS picker */}
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">min</p>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={Math.floor(stepInterval / 60)}
                  onChange={(e) => {
                    const mins = Math.min(10, Math.max(0, parseInt(e.target.value) || 0));
                    const secs = mins === 10 ? 0 : stepInterval % 60;
                    setStepInterval(clampInterval(mins * 60 + secs));
                  }}
                  className="w-20 text-center"
                />
              </div>
              <span className="pb-2 text-lg font-semibold text-muted-foreground">:</span>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">sec</p>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={stepInterval % 60}
                  onChange={(e) => {
                    const secs = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                    const mins = Math.floor(stepInterval / 60);
                    setStepInterval(clampInterval(mins * 60 + secs));
                  }}
                  className="w-20 text-center"
                  disabled={Math.floor(stepInterval / 60) === 10}
                />
              </div>
              <span className="pb-2 text-sm text-muted-foreground">
                = {formatDuration(stepInterval)}
              </span>
            </div>

            {/* Quick presets */}
            <div className="flex flex-wrap gap-2 pt-1">
              {DURATION_PRESETS.map((p) => (
                <Button
                  key={p.value}
                  type="button"
                  size="sm"
                  variant={stepInterval === p.value ? 'default' : 'outline'}
                  onClick={() => setStepInterval(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Allowed range: 5s – 10min.</p>
          </div>

          <div className="rounded-lg border border-border/80 bg-muted/35 p-3 text-xs text-muted-foreground">
            Internally calculated by backend:
            <br />
            Poll interval = max(2s, min(10s, round(interval/3)))
            <br />
            Poll timeout = max(30s, min(300s, round(interval×2)))
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={handleSaveConfig} disabled={saving}>
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
        <Button variant="outline" onClick={fetchConfig}>
          Reset
        </Button>
      </div>
    </div>
  );
}
