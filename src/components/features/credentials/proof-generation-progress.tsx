'use client';

import { Check, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { getCircuitDisplay } from '@/lib/zk/circuit-display';
import type { ProofOperation } from '@/stores/proof-store';

// ---------------------------------------------------------------------------
// Phase definitions
// ---------------------------------------------------------------------------

interface Phase {
  key: ProofOperation['phase'];
  label: string;
  description: string;
}

const PHASES: Phase[] = [
  {
    key: 'loading',
    label: 'Loading Circuit',
    description: 'Downloading circuit artifacts...',
  },
  {
    key: 'proving',
    label: 'Generating Proof',
    description: 'Computing zero-knowledge proof...',
  },
  {
    key: 'verifying',
    label: 'Verifying',
    description: 'Checking proof validity...',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProofGenerationProgressProps {
  operation: ProofOperation;
  onCancel: () => void;
}

export function ProofGenerationProgress({
  operation,
  onCancel,
}: ProofGenerationProgressProps) {
  const { circuit, phase, progress } = operation;
  const display = getCircuitDisplay(circuit);
  const Icon = display.icon;
  const currentPhaseIndex = PHASES.findIndex((p) => p.key === phase);
  const currentPhase = PHASES[currentPhaseIndex];

  return (
    <div className="flex flex-col items-center py-6 px-2">
      {/* Animated circuit icon */}
      <div className="relative mb-8">
        {/* Pulsing ring */}
        <div
          className={cn(
            'absolute inset-[-8px] rounded-full animate-ping opacity-20',
            display.ringClass.replace('border-', 'bg-').replace('/30', '/20')
          )}
        />
        {/* Spinning dashed border */}
        <div
          className={cn(
            'absolute inset-[-4px] rounded-full border-2 border-dashed animate-spin',
            display.ringClass
          )}
          style={{ animationDuration: '3s' }}
        />
        {/* Icon */}
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-surface border border-border">
          <Icon className={cn('h-8 w-8', display.iconTextClass)} />
        </div>
      </div>

      {/* Phase text */}
      <h3 className="text-base font-semibold text-text-primary mb-1">
        {currentPhase?.label ?? 'Processing'}
      </h3>
      <p className="text-sm text-text-muted mb-6">
        {currentPhase?.description ?? 'Please wait...'}
      </p>

      {/* Progress bar */}
      <div className="w-full max-w-xs mb-6">
        <Progress
          value={progress}
          className="h-2"
          indicatorClassName={display.progressClass}
        />
        <p className="text-xs text-text-muted text-center mt-2">
          {progress}%
        </p>
      </div>

      {/* Phase step indicators */}
      <div className="flex items-center gap-6 mb-6">
        {PHASES.map((p, i) => {
          const isComplete = i < currentPhaseIndex;
          const isCurrent = i === currentPhaseIndex;

          return (
            <div key={p.key} className="flex items-center gap-2">
              {isComplete ? (
                <Check className="h-4 w-4 text-near-green-500" />
              ) : isCurrent ? (
                <Loader2 className="h-4 w-4 animate-spin text-text-primary" />
              ) : (
                <div className="h-4 w-4 rounded-full border border-border" />
              )}
              <span
                className={cn(
                  'text-xs',
                  isCurrent ? 'text-text-primary font-medium' : 'text-text-muted'
                )}
              >
                {p.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Cancel */}
      <Button variant="outline" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
