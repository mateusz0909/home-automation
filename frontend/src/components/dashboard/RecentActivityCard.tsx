'use client';

import Link from 'next/link';
import { Activity, CheckCircle2, AlertCircle, ChevronRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LogEntry {
  timestamp: string;
  trigger: 'scheduled' | 'manual';
  success: boolean;
  stepsCompleted: number;
  totalSteps: number;
  finalPosition: number | null;
  durationMs: number;
  error?: string;
}

interface RecentActivityCardProps {
  logs: LogEntry[];
  loading: boolean;
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
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today ${timeStr}`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return ts;
  }
}

export function RecentActivityCard({ logs, loading }: RecentActivityCardProps) {
  const recentLogs = logs.slice(0, 3);

  return (
    <div className="panel-chassis p-5 sm:p-6">
      <div className="flex items-center justify-between pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/80 bg-secondary/80 text-foreground">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Recent Hardware Activity
            </h3>
            <p className="text-[11px] font-mono text-muted-foreground">
              Execution Telemetry Stream
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/logs"
          className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>Full History</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2 py-2">
          <div className="h-10 w-full animate-pulse rounded-lg bg-muted/60" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-muted/40" />
        </div>
      ) : recentLogs.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-[#090b10] py-6 text-center text-xs font-mono text-muted-foreground">
          No execution telemetry recorded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {recentLogs.map((log, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-xl border border-border/70 bg-[#090b10] px-3.5 py-2.5 transition-colors hover:border-border"
            >
              <div className="flex items-center gap-3">
                {log.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {log.trigger === 'scheduled' ? 'Scheduled Sunrise Routine' : 'Manual Trigger'}
                    </span>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.2 text-[10px] font-mono uppercase tracking-wider',
                        log.success
                          ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                          : 'border border-destructive/30 bg-destructive/10 text-destructive'
                      )}
                    >
                      {log.success ? 'Success' : 'Failed'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-0.5 text-[11px] font-mono text-muted-foreground">
                    <span>{formatTime(log.timestamp)}</span>
                    {log.totalSteps > 1 && (
                      <>
                        <span>·</span>
                        <span>{log.stepsCompleted}/{log.totalSteps} steps</span>
                      </>
                    )}
                    {log.finalPosition !== null && (
                      <>
                        <span>·</span>
                        <span>Final: {log.finalPosition}%</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono text-muted-foreground">
                  {formatDuration(log.durationMs)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
