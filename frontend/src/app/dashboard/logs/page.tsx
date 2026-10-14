'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, CheckCircle2, AlertCircle, RotateCw, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogEntry {
  timestamp: string;
  trigger: 'scheduled' | 'manual';
  success: boolean;
  stepsCompleted: number;
  totalSteps: number;
  finalPosition: number | null;
  durationMs: number;
  error?: string;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  return `${mins}m ${remainSecs}s`;
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString([], {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return ts;
  }
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLogs = useCallback(async () => {
    try {
      setError('');
      const res = await fetch('/api/curtain/logs?limit=30');
      if (res.status === 401) {
        window.location.href = '/';
        return;
      }
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      setError('Failed to fetch hardware execution logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalRuns = logs.length;
  const successfulRuns = logs.filter((l) => l.success).length;
  const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Title & Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Hardware Telemetry Stream</h2>
          <p className="text-xs font-mono text-muted-foreground pt-0.5">
            Historical trace of scheduled workflows and manual curtain commands
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          disabled={loading}
          className="h-8 rounded-lg border-border/80 bg-secondary/50 text-xs font-mono text-muted-foreground hover:text-foreground"
        >
          <RotateCw className={cn('mr-1.5 h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="panel-chassis p-4">
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
            Total Records
          </span>
          <div className="mt-1 font-mono text-2xl font-light text-foreground tabular-nums">
            {totalRuns}
          </div>
        </div>

        <div className="panel-chassis p-4">
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
            Success Rate
          </span>
          <div className="mt-1 font-mono text-2xl font-light text-emerald-400 tabular-nums">
            {successRate}%
          </div>
        </div>

        <div className="panel-chassis p-4">
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
            Engine Health
          </span>
          <div className="mt-1 flex items-center gap-1.5 font-mono text-sm text-foreground pt-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Optimal</span>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="panel-chassis overflow-hidden">
        <div className="border-b border-border/80 px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">Execution History</h3>
          <p className="text-[11px] font-mono text-muted-foreground">
            Timestamped records from Upstash Redis state store
          </p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs font-mono text-muted-foreground">
            Retrieving execution logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-xs font-mono text-muted-foreground">
            No execution logs recorded yet. Trigger the sunrise routine from the cockpit to populate.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#090b10] border-b border-border/70">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">Timestamp</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">Trigger Origin</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">Status</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">Steps Completed</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">Final Position</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log, i) => (
                  <TableRow key={i} className="border-b border-border/50 hover:bg-muted/30">
                    <TableCell className="font-mono text-xs text-foreground">
                      {formatTime(log.timestamp)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[11px] font-mono',
                          log.trigger === 'scheduled'
                            ? 'border border-primary/30 bg-primary/10 text-primary'
                            : 'border border-border/70 bg-secondary/50 text-muted-foreground'
                        )}
                      >
                        {log.trigger === 'scheduled' ? 'Scheduled Sunrise' : 'Manual Trigger'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-mono',
                          log.success
                            ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                            : 'border border-destructive/30 bg-destructive/10 text-destructive'
                        )}
                      >
                        {log.success ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            Success
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3" />
                            Failed
                          </>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground tabular-nums">
                      {log.stepsCompleted} / {log.totalSteps}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground tabular-nums">
                      {log.finalPosition !== null ? `${log.finalPosition}%` : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground text-right tabular-nums">
                      {formatDuration(log.durationMs)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Error Callout Panel */}
      {logs.some((l) => l.error) && (
        <div className="panel-chassis border-destructive/30 p-5 space-y-3">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <h4 className="text-xs font-semibold uppercase tracking-wider">Recent Diagnostic Faults</h4>
          </div>
          <div className="space-y-2">
            {logs
              .filter((l) => l.error)
              .slice(0, 3)
              .map((log, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs font-mono"
                >
                  <span className="text-muted-foreground">{formatTime(log.timestamp)}: </span>
                  <span className="text-destructive">{log.error}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
