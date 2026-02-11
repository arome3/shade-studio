'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
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
import {
  getCategoryLabel,
  getStatusLabel,
  getOutcomeLabel,
} from '@/lib/intelligence/decisions';
import type {
  Decision,
  DecisionCategory,
  DecisionStatus,
  DecisionOutcome,
} from '@/types/intelligence';
import type { AddDecisionInput } from '@/hooks/use-decisions';

// ============================================================================
// Constants
// ============================================================================

const CATEGORIES: DecisionCategory[] = [
  'strategic',
  'technical',
  'financial',
  'team',
  'partnership',
  'product',
  'marketing',
];

const STATUSES: DecisionStatus[] = [
  'proposed',
  'approved',
  'implemented',
  'revisited',
  'reversed',
];

const OUTCOMES: DecisionOutcome[] = [
  'pending',
  'successful',
  'partially_successful',
  'unsuccessful',
  'inconclusive',
];

// ============================================================================
// Types
// ============================================================================

interface AlternativeFormData {
  title: string;
  description: string;
  pros: string;
  cons: string;
  whyNotChosen: string;
}

export interface DecisionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: AddDecisionInput) => void;
  onUpdate?: (id: string, updates: Partial<Decision>) => void;
  editingDecision?: Decision;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Dialog for creating or editing a decision.
 * When `editingDecision` is provided, operates in edit mode.
 */
export function DecisionForm({
  open,
  onOpenChange,
  onSubmit,
  onUpdate,
  editingDecision,
}: DecisionFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<DecisionCategory>('strategic');
  const [status, setStatus] = useState<DecisionStatus>('proposed');
  const [outcome, setOutcome] = useState<DecisionOutcome>('pending');
  const [context, setContext] = useState('');
  const [rationale, setRationale] = useState('');
  const [expectedImpact, setExpectedImpact] = useState('');
  const [actualImpact, setActualImpact] = useState('');
  const [decisionDate, setDecisionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [reviewDate, setReviewDate] = useState('');
  const [decisionMakers, setDecisionMakers] = useState('');
  const [tags, setTags] = useState('');
  const [alternatives, setAlternatives] = useState<AlternativeFormData[]>([]);

  const isEditMode = !!editingDecision;

  // Pre-populate fields when editing, reset when opening for add
  useEffect(() => {
    if (open && editingDecision) {
      setTitle(editingDecision.title);
      setDescription(editingDecision.description);
      setCategory(editingDecision.category);
      setStatus(editingDecision.status);
      setOutcome(editingDecision.outcome);
      setContext(editingDecision.context);
      setRationale(editingDecision.rationale);
      setExpectedImpact(editingDecision.expectedImpact);
      setActualImpact(editingDecision.actualImpact ?? '');
      setDecisionDate(editingDecision.decisionDate);
      setReviewDate(editingDecision.reviewDate ?? '');
      setDecisionMakers(editingDecision.decisionMakers.join(', '));
      setTags(editingDecision.tags.join(', '));
      setAlternatives(
        editingDecision.alternatives.map((a) => ({
          title: a.title,
          description: a.description,
          pros: a.pros.join(', '),
          cons: a.cons.join(', '),
          whyNotChosen: a.whyNotChosen ?? '',
        }))
      );
    } else if (open && !editingDecision) {
      resetForm();
    }
  }, [open, editingDecision]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('strategic');
    setStatus('proposed');
    setOutcome('pending');
    setContext('');
    setRationale('');
    setExpectedImpact('');
    setActualImpact('');
    setDecisionDate(new Date().toISOString().slice(0, 10));
    setReviewDate('');
    setDecisionMakers('');
    setTags('');
    setAlternatives([]);
  };

  const parseCommaSeparated = (value: string): string[] =>
    value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSubmit = () => {
    if (!title.trim() || !context.trim() || !rationale.trim()) return;

    const parsedAlternatives = alternatives
      .filter((a) => a.title.trim())
      .map((a) => ({
        title: a.title.trim(),
        description: a.description.trim(),
        pros: parseCommaSeparated(a.pros),
        cons: parseCommaSeparated(a.cons),
        whyNotChosen: a.whyNotChosen.trim() || undefined,
      }));

    if (isEditMode && onUpdate && editingDecision) {
      onUpdate(editingDecision.id, {
        title: title.trim(),
        description: description.trim(),
        category,
        status,
        outcome,
        context: context.trim(),
        rationale: rationale.trim(),
        alternatives: parsedAlternatives,
        expectedImpact: expectedImpact.trim(),
        actualImpact: actualImpact.trim() || undefined,
        decisionMakers: parseCommaSeparated(decisionMakers),
        tags: parseCommaSeparated(tags),
        decisionDate,
        reviewDate: reviewDate || undefined,
      });
    } else {
      onSubmit({
        title: title.trim(),
        description: description.trim(),
        category,
        status,
        outcome,
        context: context.trim(),
        rationale: rationale.trim(),
        alternatives: parsedAlternatives,
        expectedImpact: expectedImpact.trim(),
        actualImpact: actualImpact.trim() || undefined,
        decisionMakers: parseCommaSeparated(decisionMakers),
        tags: parseCommaSeparated(tags),
        decisionDate,
        reviewDate: reviewDate || undefined,
      });
    }

    resetForm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  const addAlternative = () => {
    setAlternatives((prev) => [
      ...prev,
      { title: '', description: '', pros: '', cons: '', whyNotChosen: '' },
    ]);
  };

  const removeAlternative = (index: number) => {
    setAlternatives((prev) => prev.filter((_, i) => i !== index));
  };

  const updateAlternative = (
    index: number,
    field: keyof AlternativeFormData,
    value: string
  ) => {
    setAlternatives((prev) =>
      prev.map((alt, i) => (i === index ? { ...alt, [field]: value } : alt))
    );
  };

  const isValid = title.trim() && context.trim() && rationale.trim();

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) resetForm();
      onOpenChange(nextOpen);
    }}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Decision' : 'Record Decision'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the decision details and tracking information.'
              : 'Document a strategic decision with context, rationale, and alternatives considered.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Title <span className="text-error">*</span>
            </label>
            <Input
              placeholder="Decision title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Description
            </label>
            <Textarea
              placeholder="Brief description of the decision"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[60px]"
            />
          </div>

          {/* Category, Status, Outcome */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                Category
              </label>
              <Select value={category} onValueChange={(v) => setCategory(v as DecisionCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {getCategoryLabel(cat)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                Status
              </label>
              <Select value={status} onValueChange={(v) => setStatus(v as DecisionStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {getStatusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                Outcome
              </label>
              <Select value={outcome} onValueChange={(v) => setOutcome(v as DecisionOutcome)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map((o) => (
                    <SelectItem key={o} value={o}>
                      {getOutcomeLabel(o)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Context */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Context <span className="text-error">*</span>
            </label>
            <Textarea
              placeholder="What prompted this decision? What problem are you solving?"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="min-h-[60px]"
            />
          </div>

          {/* Rationale */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Rationale <span className="text-error">*</span>
            </label>
            <Textarea
              placeholder="Why was this option chosen over alternatives?"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              className="min-h-[60px]"
            />
          </div>

          {/* Expected Impact */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Expected Impact
            </label>
            <Textarea
              placeholder="What impact do you expect from this decision?"
              value={expectedImpact}
              onChange={(e) => setExpectedImpact(e.target.value)}
              className="min-h-[60px]"
            />
          </div>

          {/* Actual Impact — only visible when editing and outcome != pending */}
          {isEditMode && outcome !== 'pending' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                Actual Impact
              </label>
              <Textarea
                placeholder="What was the actual impact of this decision?"
                value={actualImpact}
                onChange={(e) => setActualImpact(e.target.value)}
                className="min-h-[60px]"
              />
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                Decision Date
              </label>
              <Input
                type="date"
                value={decisionDate}
                onChange={(e) => setDecisionDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                Review Date
              </label>
              <Input
                type="date"
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
              />
            </div>
          </div>

          {/* Decision Makers */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Decision Makers
            </label>
            <Input
              placeholder="Alice, Bob, Carol (comma-separated)"
              value={decisionMakers}
              onChange={(e) => setDecisionMakers(e.target.value)}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Tags
            </label>
            <Input
              placeholder="funding, roadmap, priority (comma-separated)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          {/* Alternatives */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-primary">
                Alternatives Considered
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAlternative}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Alternative
              </Button>
            </div>

            {alternatives.map((alt, index) => (
              <div
                key={index}
                className="p-3 rounded-lg bg-surface/50 border border-border space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">
                    Alternative {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeAlternative(index)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input
                  placeholder="Alternative title"
                  value={alt.title}
                  onChange={(e) =>
                    updateAlternative(index, 'title', e.target.value)
                  }
                />
                <Textarea
                  placeholder="Description"
                  value={alt.description}
                  onChange={(e) =>
                    updateAlternative(index, 'description', e.target.value)
                  }
                  className="min-h-[40px]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Pros (comma-separated)"
                    value={alt.pros}
                    onChange={(e) =>
                      updateAlternative(index, 'pros', e.target.value)
                    }
                  />
                  <Input
                    placeholder="Cons (comma-separated)"
                    value={alt.cons}
                    onChange={(e) =>
                      updateAlternative(index, 'cons', e.target.value)
                    }
                  />
                </div>
                <Input
                  placeholder="Why not chosen?"
                  value={alt.whyNotChosen}
                  onChange={(e) =>
                    updateAlternative(index, 'whyNotChosen', e.target.value)
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            {isEditMode ? 'Save Changes' : 'Record Decision'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
