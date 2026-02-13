'use client';

import { cn } from '@/lib/utils/cn';
import { CIRCUIT_DISPLAY } from '@/lib/zk/circuit-display';
import type { ZKCircuit } from '@/types/zk';

const CIRCUITS = Object.values(CIRCUIT_DISPLAY);

interface CircuitSelectorProps {
  selected: ZKCircuit | null;
  onSelect: (circuit: ZKCircuit) => void;
}

export function CircuitSelector({ selected, onSelect }: CircuitSelectorProps) {
  return (
    <div className="grid gap-3">
      {CIRCUITS.map((circuit) => {
        const Icon = circuit.icon;
        const isSelected = selected === circuit.id;

        return (
          <button
            key={circuit.id}
            type="button"
            onClick={() => onSelect(circuit.id)}
            className={cn(
              'flex items-start gap-4 rounded-xl border p-4 text-left transition-all',
              isSelected
                ? cn(circuit.borderActiveClass, 'bg-surface shadow-sm')
                : cn('border-border bg-surface/50', circuit.hoverBorderClass)
            )}
          >
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                circuit.iconBgClass
              )}
            >
              <Icon className={cn('h-5 w-5', circuit.iconTextClass)} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-text-primary">
                {circuit.name}
              </h4>
              <p className="text-xs text-text-muted mt-0.5">
                {circuit.description}
              </p>
              <p className="text-xs text-text-muted mt-1 opacity-60">
                {circuit.requirement}
              </p>
            </div>
            {isSelected && (
              <div className={cn('mt-1 h-2 w-2 rounded-full', circuit.dotColorClass)} />
            )}
          </button>
        );
      })}
    </div>
  );
}
