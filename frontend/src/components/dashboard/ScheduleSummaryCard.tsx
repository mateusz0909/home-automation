'use client';

import Link from 'next/link';
import { Clock, Calendar, ChevronRight, Power } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface ScheduleSummaryCardProps {
  timeStr: string;
  days: number[];
  timezone: string;
  enabled: boolean;
  onToggleEnabled: (enabled: boolean) => Promise<void>;
}

const DAYS_MAP = [
  { label: 'S', name: 'Sun', value: 0 },
  { label: 'M', name: 'Mon', value: 1 },
  { label: 'T', name: 'Tue', value: 2 },
  { label: 'W', name: 'Wed', value: 3 },
  { label: 'T', name: 'Thu', value: 4 },
  { label: 'F', name: 'Fri', value: 5 },
  { label: 'S', name: 'Sat', value: 6 },
];

export function ScheduleSummaryCard({
  timeStr = '07:00',
  days = [1, 2, 3, 4, 5],
  timezone = 'Europe/Prague',
  enabled = true,
  onToggleEnabled,
}: ScheduleSummaryCardProps) {
  const isEveryday = days.length === 7;
  const isWeekdays = days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d));
  const isWeekends = days.length === 2 && [0, 6].every((d) => days.includes(d));

  const cadenceLabel = isEveryday
    ? 'Every day'
    : isWeekdays
    ? 'Weekdays'
    : isWeekends
    ? 'Weekends'
    : `${days.length} days/week`;

  return (
    <div className="panel-chassis relative flex flex-col justify-between overflow-hidden p-5 sm:p-6">
      <div>
        {/* Header with Switch */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/80 bg-secondary/80 text-foreground">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                Automation Schedule
              </h3>
              <p className="text-[11px] font-mono text-muted-foreground">
                Upstash QStash Cron Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground">
              {enabled ? 'Active' : 'Suspended'}
            </span>
            <Switch
              checked={enabled}
              onCheckedChange={onToggleEnabled}
              className="data-[state=checked]:bg-primary"
            />
          </div>
        </div>

        {/* Schedule Display */}
        <div className="mt-2 flex items-baseline justify-between rounded-xl border border-border/80 bg-[#090b10] p-3.5">
          <div>
            <div className="font-mono text-3xl font-light tracking-tight text-foreground tabular-nums">
              {timeStr}
            </div>
            <p className="text-xs text-muted-foreground pt-0.5">
              {cadenceLabel} · {timezone.split('/')[1] || timezone}
            </p>
          </div>

          {/* Active days pill matrix */}
          <div className="flex items-center gap-1">
            {DAYS_MAP.map((d) => {
              const active = days.includes(d.value);
              return (
                <div
                  key={d.value}
                  title={d.name}
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-mono transition-all',
                    active
                      ? 'border border-primary/50 bg-primary/20 text-primary font-semibold'
                      : 'border border-border/40 bg-secondary/30 text-muted-foreground/60'
                  )}
                >
                  {d.label}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer link to full configuration */}
      <div className="mt-5 pt-1">
        <Link
          href="/dashboard/config"
          className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-secondary/40 px-3.5 py-2.5 text-xs font-medium text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground transition-all"
        >
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span>Customize trigger time, days & steps</span>
          </div>
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
