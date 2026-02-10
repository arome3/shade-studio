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
import { Slider } from '@/components/ui/slider';
import { getThreatLevelLabel } from '@/lib/intelligence/competitive';
import type { ThreatLevel, Competitor } from '@/types/intelligence';
import type { AddCompetitorInput } from '@/hooks/use-competitive';

export interface AddCompetitorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: AddCompetitorInput) => void;
  /** When provided, the dialog operates in edit mode */
  editingCompetitor?: Competitor;
  /** Existing competitor names for duplicate detection (case-insensitive) */
  existingNames?: string[];
}

/**
 * Dialog for adding or editing a competitor.
 * When `editingCompetitor` is provided, pre-populates fields and switches to edit mode.
 */
export function AddCompetitorDialog({
  open,
  onOpenChange,
  onSubmit,
  editingCompetitor,
  existingNames = [],
}: AddCompetitorDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [twitter, setTwitter] = useState('');
  const [github, setGithub] = useState('');
  const [categories, setCategories] = useState('');
  const [threatLevel, setThreatLevel] = useState<ThreatLevel>(3);
  const [notes, setNotes] = useState('');
  const [duplicateError, setDuplicateError] = useState('');

  const isEditMode = !!editingCompetitor;

  // Pre-populate fields when editing
  useEffect(() => {
    if (editingCompetitor) {
      setName(editingCompetitor.name);
      setDescription(editingCompetitor.description);
      setWebsite(editingCompetitor.website ?? '');
      setTwitter(editingCompetitor.twitter ?? '');
      setGithub(editingCompetitor.github ?? '');
      setCategories(editingCompetitor.categories.join(', '));
      setThreatLevel(editingCompetitor.threatLevel);
      setNotes(editingCompetitor.notes ?? '');
      setDuplicateError('');
    }
  }, [editingCompetitor]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setWebsite('');
    setTwitter('');
    setGithub('');
    setCategories('');
    setThreatLevel(3);
    setNotes('');
    setDuplicateError('');
  };

  const handleSubmit = () => {
    if (!name.trim()) return;

    // Duplicate detection for new competitors
    if (!isEditMode) {
      const normalizedName = name.trim().toLowerCase();
      const isDuplicate = existingNames.some(
        (n) => n.toLowerCase() === normalizedName
      );
      if (isDuplicate) {
        setDuplicateError(`A competitor named "${name.trim()}" already exists.`);
        return;
      }
    }

    // In edit mode, also check for name collisions (excluding the current competitor)
    if (isEditMode) {
      const normalizedName = name.trim().toLowerCase();
      const isDuplicate = existingNames.some(
        (n) =>
          n.toLowerCase() === normalizedName &&
          n.toLowerCase() !== editingCompetitor!.name.toLowerCase()
      );
      if (isDuplicate) {
        setDuplicateError(`A competitor named "${name.trim()}" already exists.`);
        return;
      }
    }

    const categoryList = categories
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      website: website.trim() || undefined,
      twitter: twitter.trim() || undefined,
      github: github.trim() || undefined,
      categories: categoryList,
      threatLevel,
      notes: notes.trim() || undefined,
    });

    resetForm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Competitor' : 'Add Competitor'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update competitor details and tracking settings.'
              : 'Track a competitor to monitor their activities and get strategic insights.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Name <span className="text-error">*</span>
            </label>
            <Input
              placeholder="Competitor name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDuplicateError('');
              }}
            />
            {duplicateError && (
              <p className="text-xs text-error">{duplicateError}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Description
            </label>
            <Textarea
              placeholder="Brief description of the competitor"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[60px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                Website
              </label>
              <Input
                placeholder="https://example.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                Twitter
              </label>
              <Input
                placeholder="@handle"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              GitHub
            </label>
            <Input
              placeholder="org/repo or org"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Categories
            </label>
            <Input
              placeholder="DeFi, NFT, DAO (comma-separated)"
              value={categories}
              onChange={(e) => setCategories(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Threat Level: {threatLevel}/5 — {getThreatLevelLabel(threatLevel)}
            </label>
            <Slider
              min={1}
              max={5}
              step={1}
              value={[threatLevel]}
              onValueChange={([v]) => setThreatLevel((v ?? 3) as ThreatLevel)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Notes
            </label>
            <Textarea
              placeholder="Additional notes about this competitor"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {isEditMode ? 'Save Changes' : 'Add Competitor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
