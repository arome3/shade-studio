'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Circle,
  Clock,
  Users,
  CalendarCheck,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  getMeetingTypeBadgeVariant,
  getMeetingTypeLabel,
  getActionPriorityBadgeVariant,
  getActionPriorityLabel,
} from '@/lib/intelligence/meetings';
import { cn } from '@/lib/utils/cn';
import type { Meeting } from '@/types/intelligence';

// ============================================================================
// Types
// ============================================================================

export interface MeetingEntryProps {
  meeting: Meeting;
  onEdit: (meeting: Meeting) => void;
  onRemove: (id: string) => void;
  onProcess: (id: string) => void;
  onCompleteAction: (meetingId: string, itemId: string) => void;
  processingId: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

function isOverdue(dueDate?: string): boolean {
  if (!dueDate) return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

// ============================================================================
// Component
// ============================================================================

/**
 * Collapsible meeting card showing summary when collapsed and full details when expanded.
 */
export function MeetingEntry({
  meeting,
  onEdit,
  onRemove,
  onProcess,
  onCompleteAction,
  processingId,
}: MeetingEntryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isThisProcessing = processingId === meeting.id;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border border-border bg-surface/50 overflow-hidden">
        {/* Collapsed header */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-3 w-full p-3 text-left hover:bg-surface-hover transition-colors"
          >
            <Clock className="h-5 w-5 text-text-muted shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {meeting.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-text-muted">{meeting.date}</span>
                {meeting.duration && (
                  <span className="text-xs text-text-muted">
                    {meeting.duration} min
                  </span>
                )}
              </div>
            </div>
            <Badge
              variant={getMeetingTypeBadgeVariant(meeting.type)}
              className="text-[10px]"
            >
              {getMeetingTypeLabel(meeting.type)}
            </Badge>
            {meeting.isProcessed ? (
              <Badge variant="success" className="text-[10px]">
                Processed
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                Unprocessed
              </Badge>
            )}
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-text-muted shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-text-muted shrink-0" />
            )}
          </button>
        </CollapsibleTrigger>

        {/* Expanded content */}
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
            {/* Attendees */}
            {meeting.attendees.length > 0 && (
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-text-muted" />
                <span className="text-xs text-text-secondary">
                  {meeting.attendees.join(', ')}
                </span>
              </div>
            )}

            {/* AI Summary */}
            {meeting.summary && (
              <div className="p-2.5 rounded-md bg-near-cyan-500/10 border border-near-cyan-500/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="h-3.5 w-3.5 text-near-cyan-500" />
                  <span className="text-xs font-medium text-near-cyan-500">
                    AI Summary
                  </span>
                </div>
                <p className="text-xs text-text-secondary">{meeting.summary}</p>
              </div>
            )}

            {/* Action Items */}
            {meeting.actionItems.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-text-muted mb-2">
                  Action Items ({meeting.actionItems.length})
                </h4>
                <div className="space-y-1.5">
                  {meeting.actionItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-2 p-2 rounded-md bg-surface/50 border border-border"
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 mt-0.5 shrink-0"
                        aria-label={item.status === 'completed' ? 'Mark as incomplete' : 'Mark as complete'}
                        onClick={(e) => {
                          e.stopPropagation();
                          onCompleteAction(meeting.id, item.id);
                        }}
                      >
                        {item.status === 'completed' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-text-muted" />
                        )}
                      </Button>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-xs',
                            item.status === 'completed'
                              ? 'text-text-muted line-through'
                              : 'text-text-primary'
                          )}
                        >
                          {item.description}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <Badge
                            variant={getActionPriorityBadgeVariant(item.priority)}
                            className="text-[9px]"
                          >
                            {getActionPriorityLabel(item.priority)}
                          </Badge>
                          {item.assignee && (
                            <span className="text-[10px] text-text-muted">
                              @{item.assignee}
                            </span>
                          )}
                          {item.dueDate && (
                            <span
                              className={cn(
                                'text-[10px]',
                                isOverdue(item.dueDate) && item.status !== 'completed'
                                  ? 'text-error'
                                  : 'text-text-muted'
                              )}
                            >
                              {item.dueDate}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Decisions */}
            {meeting.decisions.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-text-muted mb-1">
                  Decisions
                </h4>
                <ul className="space-y-1">
                  {meeting.decisions.map((decision, index) => (
                    <li
                      key={index}
                      className="text-xs text-text-secondary flex items-start gap-1.5"
                    >
                      <span className="text-near-green-500 mt-0.5">•</span>
                      {decision}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Follow-up indicator */}
            {meeting.followUpNeeded && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-warning/10 border border-warning/20">
                <CalendarCheck className="h-3.5 w-3.5 text-warning" />
                <span className="text-xs text-warning">
                  Follow-up needed
                  {meeting.followUpDate && ` by ${meeting.followUpDate}`}
                </span>
              </div>
            )}

            {/* Tags */}
            {meeting.tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {meeting.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => onProcess(meeting.id)}
                disabled={isThisProcessing}
              >
                <RefreshCw
                  className={cn(
                    'h-3.5 w-3.5',
                    isThisProcessing && 'animate-spin'
                  )}
                />
                {meeting.isProcessed ? 'Re-process' : 'Process'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => onEdit(meeting)}
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-error"
                onClick={() => onRemove(meeting.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
