'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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

export default function DashboardPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [commandResult, setCommandResult] = useState<CommandResult | null>(null);
  const [error, setError] = useState('');

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
      setError('Failed to fetch curtain status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  async function handleCommand(command: 'open' | 'close' | 'stop') {
    setActiveCommand(command);
    setCommandResult(null);

    try {
      const res = await fetch('/api/curtain/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      const data = await res.json();
      setCommandResult(data);
      await fetchStatus();
    } catch {
      setCommandResult({
        message: 'Network error',
        success: false,
        error: 'Could not reach the server',
      });
    } finally {
      setActiveCommand(null);
    }
  }

  async function handleGradualOpen() {
    setActiveCommand('gradual');
    setCommandResult(null);

    try {
      const res = await fetch('/api/curtain/trigger', { method: 'POST' });
      const data = await res.json();
      setCommandResult(data);
      await fetchStatus();
    } catch {
      setCommandResult({
        message: 'Network error',
        success: false,
        error: 'Could not reach the server',
      });
    } finally {
      setActiveCommand(null);
    }
  }

  const position = status?.position ?? null;
  const isOpen = position !== null && position >= 100;
  const isClosed = position !== null && position === 0;
  const isBusy = activeCommand !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="page-title">Dashboard</h2>
        <Button variant="outline" onClick={fetchStatus} disabled={loading}>
          Refresh Status
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardDescription>Current Position</CardDescription>
        </CardHeader>
        <CardContent>
        {loading ? (
            <div className="h-12 w-28 animate-pulse rounded-md bg-muted" />
        ) : (
          <>
              <div className="status-number">
              {position !== null ? `${position}%` : '—'}
            </div>
              <p className="mt-2 text-sm text-muted-foreground">
              {position === null
                ? 'Unable to read device'
                : position === 0
                  ? 'Fully closed'
                  : position >= 100
                    ? 'Fully open'
                    : 'Partially open'}
              </p>
            {position !== null && (
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, position))}%` }}
                />
              </div>
            )}
          </>
        )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button
            onClick={() => handleCommand('open')}
            disabled={isBusy || isOpen}
          >
            {activeCommand === 'open' ? '⏳ Opening...' : '▲ Open'}
            </Button>
            <Button
              variant="secondary"
            onClick={() => handleCommand('stop')}
            disabled={isBusy || isClosed || isOpen}
          >
            {activeCommand === 'stop' ? '⏳ Stopping...' : '⏸ Stop'}
            </Button>
            <Button
              variant="destructive"
            onClick={() => handleCommand('close')}
            disabled={isBusy || isClosed}
          >
            {activeCommand === 'close' ? '⏳ Closing...' : '▼ Close'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gradual Opening</CardTitle>
          <CardDescription>
            Opens the curtain step-by-step using configured schedule steps. This can take a few minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleGradualOpen} disabled={isBusy || isOpen}>
            {activeCommand === 'gradual' ? '⏳ Running automation...' : '☀️ Gradual Open'}
          </Button>

          {activeCommand === 'gradual' && (
            <p className="text-sm text-muted-foreground">
              The automation runs for several minutes. This page updates when complete.
            </p>
          )}
        </CardContent>
      </Card>

      {commandResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last Command Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={
                commandResult.success
                  ? 'rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400'
                  : 'rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'
              }
            >
              {commandResult.message}
            </div>
            {commandResult.stepsCompleted !== undefined && (
              <p className="mt-2 text-sm text-muted-foreground">
                Steps: {commandResult.stepsCompleted}/{commandResult.totalSteps}
                {commandResult.finalPosition !== null && commandResult.finalPosition !== undefined &&
                  ` · Final: ${commandResult.finalPosition}%`}
                {commandResult.durationMs && ` · Duration: ${(commandResult.durationMs / 1000).toFixed(1)}s`}
              </p>
            )}
            {commandResult.error && <p className="mt-1 text-sm text-destructive">{commandResult.error}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Status auto-refreshes every 30 seconds.</p>
          {status?.timestamp && <p>Last checked: {new Date(status.timestamp).toLocaleString()}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
