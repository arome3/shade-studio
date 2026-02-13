'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Download,
  Trash2,
  FileOutput,
  Lock,
  Unlock,
  ShieldCheck,
  Shield,
  Share2,
  Settings,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import type { ActivityEntry, ActivityAction } from '@/types/data-sovereignty';

// ============================================================================
// Types
// ============================================================================

interface ActivityLogProps {
  activities: ActivityEntry[];
  onClear: () => void;
}

// ============================================================================
// Action Display Config
// ============================================================================

const ACTION_CONFIG: Record<ActivityAction, {
  icon: typeof Upload;
  colorClass: string;
  dotClass: string;
}> = {
  upload: { icon: Upload, colorClass: 'text-near-green-500', dotClass: 'bg-near-green-500' },
  download: { icon: Download, colorClass: 'text-info', dotClass: 'bg-info' },
  delete: { icon: Trash2, colorClass: 'text-error', dotClass: 'bg-error' },
  export: { icon: FileOutput, colorClass: 'text-info', dotClass: 'bg-info' },
  encrypt: { icon: Lock, colorClass: 'text-near-green-500', dotClass: 'bg-near-green-500' },
  decrypt: { icon: Unlock, colorClass: 'text-warning', dotClass: 'bg-warning' },
  'proof-generate': { icon: Shield, colorClass: 'text-warning', dotClass: 'bg-warning' },
  'proof-verify': { icon: ShieldCheck, colorClass: 'text-near-green-500', dotClass: 'bg-near-green-500' },
  share: { icon: Share2, colorClass: 'text-near-cyan-500', dotClass: 'bg-near-cyan-500' },
  'setting-change': { icon: Settings, colorClass: 'text-text-muted', dotClass: 'bg-text-muted' },
};

// ============================================================================
// Component
// ============================================================================

export function ActivityLog({ activities, onClear }: ActivityLogProps) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-muted">
        <Activity className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">No activity yet</p>
        <p className="text-xs mt-1">Operations on your data will be logged here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          {activities.length} event{activities.length !== 1 ? 's' : ''}
        </p>
        <Button variant="ghost" size="sm" onClick={onClear} className="text-xs h-7">
          Clear Log
        </Button>
      </div>

      <ScrollArea className="max-h-[400px]">
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {activities.map((entry, i) => {
              const config = ACTION_CONFIG[entry.action];
              const Icon = config.icon;

              return (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-surface transition-colors"
                >
                  {/* Icon */}
                  <div className={`mt-0.5 p-1.5 rounded-md bg-surface ${config.colorClass}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary leading-snug">
                      {entry.description}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {formatDistanceToNow(entry.timestamp, { addSuffix: true })}
                    </p>
                  </div>

                  {/* Action dot */}
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${config.dotClass}`} />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
}
