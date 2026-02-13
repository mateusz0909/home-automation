'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLogs = useCallback(async () => {
    try {
      setError('');
      const res = await fetch('/api/curtain/logs?limit=20');
      if (res.status === 401) {
        window.location.href = '/';
        return;
      }
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      setError('Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

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
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return ts;
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="page-title">Execution Logs</h2>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent executions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No execution logs yet. Trigger automation to see results here.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Steps</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log, i) => (
                  <TableRow key={i}>
                    <TableCell>{formatTime(log.timestamp)}</TableCell>
                    <TableCell>
                      <Badge variant={log.trigger === 'scheduled' ? 'secondary' : 'outline'}>{log.trigger}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.success ? 'default' : 'destructive'}>{log.success ? 'OK' : 'FAIL'}</Badge>
                    </TableCell>
                    <TableCell>
                      {log.stepsCompleted}/{log.totalSteps}
                    </TableCell>
                    <TableCell>{log.finalPosition !== null ? `${log.finalPosition}%` : '—'}</TableCell>
                    <TableCell>{formatDuration(log.durationMs)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {logs.some((l) => l.error) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Errors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {logs
              .filter((l) => l.error)
              .slice(0, 5)
              .map((log, i) => (
                <div key={i} className="rounded-md border border-destructive/25 bg-destructive/5 p-3">
                  <p className="text-xs text-muted-foreground">{formatTime(log.timestamp)}</p>
                  <p className="text-sm text-destructive">{log.error}</p>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
