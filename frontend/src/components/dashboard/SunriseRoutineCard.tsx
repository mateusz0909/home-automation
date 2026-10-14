'use client';

import { Sunrise, Clock, AlertCircle, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SunriseRoutineCardProps {
  activeCommand: string | null;
  isOpen: boolean;
  steps: number[];
  intervalSeconds: number;
  onTrigger: () => Promise<void>;
  onStop: () => Promise<void>;
}

export function SunriseRoutineCard({
  activeCommand,
  isOpen,
  steps = [10, 20, 30, 40, 50, 60, 70, 80, 90],
  intervalSeconds = 15,
  onTrigger,
  onStop,
}: SunriseRoutineCardProps) {
  const isRunning = activeCommand === 'gradual';
  const effectiveSteps = steps.length > 0 ? steps : [10, 25, 45, 70, 90];
  const totalDurationSeconds = effectiveSteps.length * intervalSeconds;
  const minutes = Math.floor(totalDurationSeconds / 60);
  const seconds = totalDurationSeconds % 60;
  const durationLabel = minutes > 0 ? `${minutes}m ${seconds > 0 ? `${seconds}s` : ''}` : `${seconds}s`;

  return (
    <div className="panel-chassis relative flex flex-col justify-between overflow-hidden p-5 sm:p-6">
      {/* Background ambient solar glow */}
      <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <Sunrise className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                Sunrise Routine
              </h3>
              <p className="text-[11px] font-mono text-muted-foreground">
                Gradual Circadian Opening
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-secondary/60 px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>~{durationLabel} total</span>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs leading-relaxed text-muted-foreground pt-1">
          Simulates natural dawn by waking the room through progressive incremental positions.
        </p>

        {/* Stepped Timeline Visualizer */}
        <div className="mt-4 rounded-xl border border-border/80 bg-[#090b10] p-3">
          <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground mb-2">
            <span>Staged Sequence</span>
            <span>{effectiveSteps.length} stages · {intervalSeconds}s interval</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {effectiveSteps.map((step, idx) => (
              <div
                key={step}
                className={cn(
                  'flex-1 min-w-[32px] rounded-md border py-1 text-center font-mono text-[11px] transition-all',
                  isRunning
                    ? 'border-amber-500/50 bg-amber-500/20 text-amber-300 animate-pulse'
                    : 'border-border/60 bg-secondary/40 text-muted-foreground'
                )}
              >
                {step}%
              </div>
            ))}
            <div className="rounded-md border border-border/60 bg-secondary/70 px-2 py-1 font-mono text-[11px] text-foreground font-semibold">
              100%
            </div>
          </div>
        </div>
      </div>

      {/* Action footer */}
      <div className="mt-5 pt-1">
        {isRunning ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-mono text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              <span>Routine active · Stepping through dawn curve</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onStop}
              className="h-10 rounded-xl border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 text-xs font-medium"
            >
              <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
              Abort
            </Button>
          </div>
        ) : (
          <Button
            onClick={onTrigger}
            disabled={isOpen || activeCommand !== null}
            className="w-full h-11 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-600/30 to-amber-500/20 text-amber-200 hover:from-amber-600/40 hover:to-amber-500/30 font-medium text-xs sm:text-sm transition-all"
          >
            <Play className="mr-2 h-4 w-4 fill-current text-amber-400" />
            Start Sunrise Routine Now
          </Button>
        )}
      </div>
    </div>
  );
}
