'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getMeetingTypeLabel } from '@/lib/intelligence/meetings';
import { cn } from '@/lib/utils/cn';
import type { Meeting, MeetingType } from '@/types/intelligence';
import type { AddMeetingInput } from '@/hooks/use-meetings';

// ============================================================================
// Constants
// ============================================================================

const MEETING_TYPES: MeetingType[] = [
  'team',
  'funder',
  'partner',
  'advisor',
  'community',
  'other',
];

// ============================================================================
// Types
// ============================================================================

export interface MeetingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: AddMeetingInput) => void;
  onUpdate?: (id: string, updates: Partial<Meeting>) => void;
  editingMeeting?: Meeting;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Dialog for creating or editing a meeting.
 * When `editingMeeting` is provided, operates in edit mode.
 */
export function MeetingForm({
  open,
  onOpenChange,
  onSubmit,
  onUpdate,
  editingMeeting,
}: MeetingFormProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<MeetingType>('team');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState('');
  const [attendees, setAttendees] = useState('');
  const [rawNotes, setRawNotes] = useState('');
  const [relatedProject, setRelatedProject] = useState('');
  const [tags, setTags] = useState('');
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');

  const isEditMode = !!editingMeeting;

  // Pre-populate fields when editing, reset when opening for add
  useEffect(() => {
    if (open && editingMeeting) {
      setTitle(editingMeeting.title);
      setType(editingMeeting.type);
      setDate(editingMeeting.date);
      setDuration(editingMeeting.duration?.toString() ?? '');
      setAttendees(editingMeeting.attendees.join(', '));
      setRawNotes(editingMeeting.rawNotes);
      setRelatedProject(editingMeeting.relatedProject ?? '');
      setTags(editingMeeting.tags.join(', '));
      setFollowUpNeeded(editingMeeting.followUpNeeded);
      setFollowUpDate(editingMeeting.followUpDate ?? '');
    } else if (open && !editingMeeting) {
      resetForm();
    }
  }, [open, editingMeeting]);

  const resetForm = () => {
    setTitle('');
    setType('team');
    setDate(new Date().toISOString().slice(0, 10));
    setDuration('');
    setAttendees('');
    setRawNotes('');
    setRelatedProject('');
    setTags('');
    setFollowUpNeeded(false);
    setFollowUpDate('');
  };

  const parseCommaSeparated = (value: string): string[] =>
    value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSubmit = () => {
    if (!title.trim() || !rawNotes.trim()) return;

    const parsedAttendees = parseCommaSeparated(attendees);
    const parsedTags = parseCommaSeparated(tags);
    const parsedDuration = duration ? parseInt(duration, 10) : undefined;

    if (isEditMode && onUpdate && editingMeeting) {
      onUpdate(editingMeeting.id, {
        title: title.trim(),
        type,
        date,
        duration: parsedDuration,
        attendees: parsedAttendees,
        rawNotes: rawNotes.trim(),
        relatedProject: relatedProject.trim() || undefined,
        tags: parsedTags,
        followUpNeeded,
        followUpDate: followUpDate || undefined,
      });
    } else {
      onSubmit({
        title: title.trim(),
        type,
        date,
        duration: parsedDuration,
        attendees: parsedAttendees,
        rawNotes: rawNotes.trim(),
        relatedProject: relatedProject.trim() || undefined,
        tags: parsedTags,
        followUpNeeded,
        followUpDate: followUpDate || undefined,
      });
    }

    resetForm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  const isValid = title.trim() && rawNotes.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetForm();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Meeting' : 'Add Meeting'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the meeting details and notes.'
              : 'Record meeting notes for AI-powered extraction of action items, decisions, and summaries.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Title <span className="text-error">*</span>
            </label>
            <Input
              placeholder="Meeting title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Type and Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                Type
              </label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as MeetingType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEETING_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {getMeetingTypeLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                Date
              </label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Duration and Attendees */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                Duration (minutes)
              </label>
              <Input
                type="number"
                placeholder="60"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min={1}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                Attendees
              </label>
              <Input
                placeholder="Alice, Bob, Carol"
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
              />
            </div>
          </div>

          {/* Raw Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Meeting Notes <span className="text-error">*</span>
            </label>
            <Textarea
              placeholder="Paste or type your meeting notes here. AI will extract action items, decisions, and a summary automatically."
              value={rawNotes}
              onChange={(e) => setRawNotes(e.target.value)}
              className="min-h-[160px]"
            />
          </div>

          {/* Related Project */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Related Project
            </label>
            <Input
              placeholder="Project name or ID"
              value={relatedProject}
              onChange={(e) => setRelatedProject(e.target.value)}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Tags
            </label>
            <Input
              placeholder="sprint, planning, review (comma-separated)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          {/* Follow-up */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={followUpNeeded}
                onClick={() => setFollowUpNeeded(!followUpNeeded)}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  followUpNeeded ? 'bg-near-green-500' : 'bg-surface-hover'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition-transform',
                    followUpNeeded ? 'translate-x-4' : 'translate-x-0'
                  )}
                />
              </button>
              <label className="text-sm font-medium text-text-primary">
                Follow-up Needed
              </label>
            </div>
            {followUpNeeded && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  Follow-up Date
                </label>
                <Input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            {isEditMode ? 'Save Changes' : 'Add Meeting'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

