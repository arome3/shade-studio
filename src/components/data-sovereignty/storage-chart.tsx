'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Database } from 'lucide-react';
import { formatBytes } from '@/lib/utils/format';
import type { StorageSummary } from '@/types/data-sovereignty';

// ============================================================================
// Types
// ============================================================================

interface StorageChartProps {
  summary: StorageSummary;
}

// ============================================================================
// SVG Donut Chart Constants
// ============================================================================

const CENTER_X = 100;
const CENTER_Y = 100;
const RADIUS = 70;
const STROKE_WIDTH = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ============================================================================
// Component
// ============================================================================

export function StorageChart({ summary }: StorageChartProps) {
  const arcs = useMemo(() => {
    if (summary.breakdown.length === 0) return [];

    let cumulativeOffset = 0;
    return summary.breakdown.map((segment) => {
      const segmentLength = (segment.percentage / 100) * CIRCUMFERENCE;
      const offset = cumulativeOffset;
      cumulativeOffset += segmentLength;

      return {
        ...segment,
        dashArray: `${segmentLength} ${CIRCUMFERENCE - segmentLength}`,
        dashOffset: -offset,
        color: segment.config.hex,
      };
    });
  }, [summary.breakdown]);

  // Empty state
  if (summary.totalItems === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-muted">
        <Database className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">No data stored yet</p>
        <p className="text-xs mt-1">Upload documents or generate credentials to see storage breakdown</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Donut Chart */}
      <div className="flex justify-center">
        <div className="relative w-48 h-48">
          <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
            {/* Background track */}
            <circle
              cx={CENTER_X}
              cy={CENTER_Y}
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE_WIDTH}
              className="text-surface"
            />

            {/* Data arcs */}
            {arcs.map((arc, i) => (
              <motion.circle
                key={arc.location}
                cx={CENTER_X}
                cy={CENTER_Y}
                r={RADIUS}
                fill="none"
                stroke={arc.color}
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={arc.dashArray}
                strokeDashoffset={arc.dashOffset}
                strokeLinecap="butt"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                  duration: 0.8,
                  delay: i * 0.15,
                  ease: 'easeOut',
                }}
              />
            ))}
          </svg>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              className="text-lg font-bold text-text-primary"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
            >
              {formatBytes(summary.totalBytes)}
            </motion.span>
            <span className="text-xs text-text-muted">
              {summary.totalItems} item{summary.totalItems !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Location detail cards */}
      <div className="grid grid-cols-2 gap-3">
        {summary.breakdown.map((segment, i) => {
          const Icon = segment.config.icon;
          return (
            <motion.div
              key={segment.location}
              className="rounded-lg border border-border bg-background-secondary p-3 hover:border-border-hover transition-all"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: segment.config.hex }}
                />
                <Icon className={`h-3.5 w-3.5 ${segment.config.tailwindColor}`} />
                <span className="text-xs font-medium text-text-primary truncate">
                  {segment.config.label}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-text-primary">
                  {formatBytes(segment.totalBytes)}
                </span>
                <span className="text-xs text-text-muted">
                  {segment.itemCount} item{segment.itemCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-surface overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: segment.config.hex }}
                  initial={{ width: 0 }}
                  animate={{ width: `${segment.percentage}%` }}
                  transition={{ duration: 0.6, delay: 0.3 + i * 0.1 }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
