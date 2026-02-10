'use client';

import { useState } from 'react';
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
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { AddEntryInput } from '@/hooks/use-competitive';
import type { CompetitiveEntryType } from '@/types/intelligence';

export interface AddEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competitorId: string;
  competitorName: string;
  onSubmit: (input: AddEntryInput) => Promise<void>;
}

const entryTypeOptions: { value: CompetitiveEntryType; label: string }[] = [
  { value: 'funding', label: 'Funding' },
  { value: 'launch', label: 'Launch' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'news', label: 'News' },
  { value: 'grant', label: 'Grant' },
];

/**
 * Dialog for adding a competitive entry to a specific competitor.
 */
export function AddEntryDialog({
  open,
  onOpenChange,
  competitorId,
  competitorName,
  onSubmit,
}: AddEntryDialogProps) {
  const [type, setType] = useState<CompetitiveEntryType>('news');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [relevance, setRelevance] = useState(50);
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setType('news');
    setTitle('');
    setDescription('');
    setSourceUrl('');
    setDate(new Date().toISOString().slice(0, 10));
    setRelevance(50);
    setAmount('');
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        competitorId,
        type,
        title: title.trim(),
        description: description.trim(),
        sourceUrl: sourceUrl.trim() || undefined,
        date,
        relevance,
        amount: type === 'funding' && amount ? Number(amount) : undefined,
      });
      resetForm();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Entry</DialogTitle>
          <DialogDescription>
            Add a competitive intelligence entry for {competitorName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Type
            </label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as CompetitiveEntryType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {entryTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Title <span className="text-error">*</span>
            </label>
            <Input
              placeholder="Entry title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Description
            </label>
            <Textarea
              placeholder="Details about this event"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[60px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                Source URL
              </label>
              <Input
                placeholder="https://..."
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />
            </div>
          </div>

          {type === 'funding' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                Amount (USD)
              </label>
              <Input
                type="number"
                placeholder="e.g. 10000000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={0}
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Relevance: {relevance}/100
            </label>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[relevance]}
              onValueChange={([v]) => setRelevance(v ?? 50)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Analyzing...' : 'Add Entry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
