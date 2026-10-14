'use client';

import { useState, useRef, useEffect, MouseEvent, TouchEvent } from 'react';
import { Sunrise, Sunset, Square, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CurtainStageProps {
  position: number | null;
  loading: boolean;
  activeCommand: string | null;
  onCommand: (command: 'open' | 'close' | 'stop') => Promise<void>;
  onSetPercent: (percent: number) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function CurtainStage({
  position,
  loading,
  activeCommand,
  onCommand,
  onSetPercent,
  onRefresh,
}: CurtainStageProps) {
  // Local scrub state for direct dragging
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPercent, setScrubPercent] = useState<number>(position ?? 0);
  const trackRef = useRef<HTMLDivElement>(null);

  // Sync scrubPercent with incoming hardware position when not actively dragging
  useEffect(() => {
    if (!isScrubbing && position !== null) {
      setScrubPercent(position);
    }
  }, [position, isScrubbing]);

  const currentPercent = isScrubbing ? scrubPercent : (position ?? 0);
  const isBusy = activeCommand !== null;
  const isMoving = isBusy || activeCommand === 'open' || activeCommand === 'close' || activeCommand === 'gradual';

  // Drapery width calculation (50% closed down to 6% stacked open)
  // When percent = 0 -> panelWidth = 50%
  // When percent = 100 -> panelWidth = 6%
  const panelWidthPercent = Math.max(6, 50 - (currentPercent / 100) * 44);

  // Calculate daylight illumination opacity (0.1 at 0% to 1.0 at 100%)
  const daylightOpacity = Math.max(0.08, currentPercent / 100);

  function handleScrub(clientX: number) {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const rawRatio = (clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(100, Math.round(rawRatio * 100)));
    setScrubPercent(clamped);
  }

  function handleMouseDown(e: MouseEvent) {
    if (isBusy) return;
    setIsScrubbing(true);
    handleScrub(e.clientX);

    const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
      handleScrub(moveEvent.clientX);
    };

    const onMouseUp = (upEvent: globalThis.MouseEvent) => {
      setIsScrubbing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (trackRef.current) {
        const r = trackRef.current.getBoundingClientRect();
        const ratio = (upEvent.clientX - r.left) / r.width;
        const finalVal = Math.max(0, Math.min(100, Math.round(ratio * 100)));
        onSetPercent(finalVal);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function handleTouchStart(e: TouchEvent) {
    if (isBusy || e.touches.length === 0) return;
    setIsScrubbing(true);
    handleScrub(e.touches[0].clientX);
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isScrubbing || e.touches.length === 0) return;
    handleScrub(e.touches[0].clientX);
  }

  function handleTouchEnd() {
    if (!isScrubbing) return;
    setIsScrubbing(false);
    onSetPercent(scrubPercent);
  }

  const presets = [
    { label: '0% Closed', value: 0 },
    { label: '25%', value: 25 },
    { label: '50% Half', value: 50 },
    { label: '75%', value: 75 },
    { label: '100% Open', value: 100 },
  ];

  return (
    <div className="panel-chassis relative overflow-hidden p-5 sm:p-7">
      {/* Top telemetry bar */}
      <div className="flex items-center justify-between pb-4">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Aperture Elevation
          </span>
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-base font-semibold text-foreground">
              Physical Window Stage
            </span>
            {isBusy && (
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-mono font-medium text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                Motor Active
              </span>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading || isBusy}
          className="h-8 rounded-lg border-border/80 bg-secondary/50 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <RotateCw className={cn('mr-1.5 h-3.5 w-3.5', loading && 'animate-spin')} />
          Sync
        </Button>
      </div>

      {/* The Architectural Window Stage (Window Frame + Daylight Aperture + Dual Drapery) */}
      <div className="relative mx-auto mt-2 h-56 w-full max-w-xl overflow-hidden rounded-xl border border-border/90 bg-[#07090e] shadow-inner sm:h-64">
        {/* Window Head / Rail Header */}
        <div className="absolute inset-x-0 top-0 z-20 flex h-4 items-center justify-between border-b border-white/5 bg-[#12151e] px-4">
          <div className="h-1 w-12 rounded-full bg-white/10" />
          <div className="h-1 w-24 rounded-full bg-white/10" />
          <div className="h-1 w-12 rounded-full bg-white/10" />
        </div>

        {/* Daylight Backdrop Layer (Changes intensity with position) */}
        <div
          className="daylight-aperture absolute inset-0 transition-opacity duration-700 ease-out"
          style={{ opacity: daylightOpacity }}
        >
          {/* Subtle Sun / Horizon Rays */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 h-36 w-72 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="h-20 w-20 rounded-full border border-amber-300/30 bg-amber-200/10 blur-[1px]" />
          </div>
        </div>

        {/* Architectural Window Mullions (Window panes grid behind curtains) */}
        <div className="absolute inset-0 z-10 grid grid-cols-2 grid-rows-2 divide-x divide-y divide-white/10 opacity-30 pointer-events-none">
          <div />
          <div />
          <div />
          <div />
        </div>

        {/* Left Curtain Drapery */}
        <div
          className="curtain-fabric-left absolute left-0 top-4 bottom-0 z-20 transition-all duration-300 ease-out"
          style={{ width: `${panelWidthPercent}%` }}
        >
          {/* Fabric pleat lines */}
          <div className="curtain-pleat-pattern absolute inset-0 opacity-80" />
          {/* Bottom Hem */}
          <div className="absolute inset-x-0 bottom-0 h-3 border-t border-white/10 bg-black/40" />
        </div>

        {/* Right Curtain Drapery */}
        <div
          className="curtain-fabric-right absolute right-0 top-4 bottom-0 z-20 transition-all duration-300 ease-out"
          style={{ width: `${panelWidthPercent}%` }}
        >
          {/* Fabric pleat lines */}
          <div className="curtain-pleat-pattern absolute inset-0 opacity-80" />
          {/* Bottom Hem */}
          <div className="absolute inset-x-0 bottom-0 h-3 border-t border-white/10 bg-black/40" />
        </div>

        {/* Center Light Seam when closed */}
        {currentPercent === 0 && (
          <div className="absolute inset-y-4 left-1/2 z-20 w-[1px] -translate-x-1/2 bg-amber-200/30 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
        )}

        {/* Window Sill / Base */}
        <div className="absolute inset-x-0 bottom-0 z-30 h-3 border-t border-border/80 bg-[#161a26]" />
      </div>

      {/* Numerical Telemetry & Human Status */}
      <div className="mt-5 flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="status-number text-foreground">
            {position !== null ? `${currentPercent}%` : '—'}
          </span>
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {isScrubbing
              ? 'Target'
              : position === null
              ? 'Offline'
              : position === 0
              ? 'Closed'
              : position >= 100
              ? 'Fully Open'
              : 'Partially Open'}
          </span>
        </div>

        <div className="text-right">
          <span className="text-xs font-mono text-muted-foreground">
            {isBusy ? 'Actuating motor...' : 'Direct Control'}
          </span>
        </div>
      </div>

      {/* Tactile Scrubber Rail */}
      <div className="mt-3 select-none">
        <div
          ref={trackRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="group relative flex h-7 w-full cursor-ew-resize items-center"
        >
          {/* Track background */}
          <div className="relative h-2.5 w-full overflow-hidden rounded-full border border-border/80 bg-muted/80">
            {/* Active filled region */}
            <div
              className="h-full bg-gradient-to-r from-amber-600 via-primary to-amber-300 transition-all duration-75"
              style={{ width: `${currentPercent}%` }}
            />
          </div>

          {/* Tactile Scrubber Thumb */}
          <div
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background shadow-lg transition-transform hover:scale-125 active:scale-110"
            style={{ left: `${currentPercent}%` }}
          >
            <div className="h-full w-full rounded-full bg-primary/20" />
          </div>
        </div>

        {/* Tactile Preset Stop Chips */}
        <div className="mt-2 flex items-center justify-between gap-1 sm:gap-2">
          {presets.map((preset) => {
            const isActive = position === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => onSetPercent(preset.value)}
                disabled={isBusy}
                className={cn(
                  'flex-1 rounded-lg border py-1.5 text-center text-xs font-mono transition-all',
                  isActive
                    ? 'border-primary/60 bg-primary/15 text-primary font-semibold shadow-sm shadow-primary/10'
                    : 'border-border/60 bg-secondary/40 text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground'
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary Hardware Controls (Open, Pause, Close) */}
      <div className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-3">
        <Button
          onClick={() => onCommand('open')}
          disabled={isBusy || position === 100}
          className="h-12 rounded-xl border border-primary/40 bg-primary/10 text-foreground hover:bg-primary/20 hover:border-primary/70 transition-all"
        >
          <Sunrise className="mr-2 h-4 w-4 text-primary" />
          <span className="font-medium text-xs sm:text-sm">
            {activeCommand === 'open' ? 'Opening...' : 'Open Full'}
          </span>
        </Button>

        <Button
          variant="secondary"
          onClick={() => onCommand('stop')}
          disabled={isBusy && activeCommand !== 'open' && activeCommand !== 'close'}
          className="h-12 rounded-xl border border-border/80 bg-secondary text-foreground hover:bg-muted transition-all"
        >
          <Square className="mr-2 h-3.5 w-3.5 fill-current opacity-80" />
          <span className="font-medium text-xs sm:text-sm">
            {activeCommand === 'stop' ? 'Holding...' : 'Hold / Stop'}
          </span>
        </Button>

        <Button
          variant="secondary"
          onClick={() => onCommand('close')}
          disabled={isBusy || position === 0}
          className="h-12 rounded-xl border border-border/80 bg-secondary text-foreground hover:bg-muted transition-all"
        >
          <Sunset className="mr-2 h-4 w-4 text-slate-300" />
          <span className="font-medium text-xs sm:text-sm">
            {activeCommand === 'close' ? 'Closing...' : 'Close Full'}
          </span>
        </Button>
      </div>
    </div>
  );
}
