'use client';

import { useState, useEffect } from 'react';
import {
  Sparkles,
  Wand2,
  PenLine,
  MessageSquare,
  Copy,
  ArrowDownToLine,
  Loader2,
  X,
  Send,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils/cn';
import type { AIAction } from '@/hooks/use-proposal-ai';

// ============================================================================
// Types
// ============================================================================

export interface AIAssistantPanelProps {
  suggestion: string | null;
  isGenerating: boolean;
  aiError: string | null;
  lastAction: AIAction | null;
  sectionHasContent: boolean;
  onImprove: () => void;
  onGenerate: () => void;
  onReview: () => void;
  onCustomPrompt: (prompt: string) => void;
  onInsert: () => void;
  onCopy: () => void;
  onClear: () => void;
  onCancel: () => void;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const QUICK_ACTIONS = [
  {
    id: 'improve' as const,
    label: 'Improve',
    icon: Wand2,
    description: 'Enhance clarity and impact',
    needsContent: true,
  },
  {
    id: 'generate' as const,
    label: 'Generate',
    icon: PenLine,
    description: 'Create a draft',
    needsContent: false,
  },
  {
    id: 'review' as const,
    label: 'Review',
    icon: MessageSquare,
    description: 'Get feedback',
    needsContent: true,
  },
];

// ============================================================================
// Component
// ============================================================================

export function AIAssistantPanel({
  suggestion,
  isGenerating,
  aiError,
  lastAction,
  sectionHasContent,
  onImprove,
  onGenerate,
  onReview,
  onCustomPrompt,
  onInsert,
  onCopy,
  onClear,
  onCancel,
  className,
}: AIAssistantPanelProps) {
  const [customInput, setCustomInput] = useState('');
  const [pendingInsert, setPendingInsert] = useState(false);

  // Clear pending insert when suggestion changes or is cleared
  useEffect(() => {
    setPendingInsert(false);
  }, [suggestion]);

  const handleInsertClick = () => {
    if (sectionHasContent) {
      setPendingInsert(true);
    } else {
      onInsert();
    }
  };

  const handleConfirmReplace = () => {
    onInsert();
    setPendingInsert(false);
  };

  const handleCancelReplace = () => {
    setPendingInsert(false);
  };

  const handleAction = (actionId: string) => {
    if (actionId === 'improve') onImprove();
    else if (actionId === 'generate') onGenerate();
    else if (actionId === 'review') onReview();
  };

  const handleCustomSubmit = () => {
    if (!customInput.trim()) return;
    onCustomPrompt(customInput.trim());
    setCustomInput('');
  };

  const handleCopy = async () => {
    if (!suggestion) return;
    await navigator.clipboard.writeText(suggestion);
    onCopy();
  };

  return (
    <div className={cn('flex flex-col border-l border-border', className)}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-near-purple-500" />
          <h4 className="text-sm font-medium text-text-primary">AI Assistant</h4>
        </div>
        <p className="text-xs text-text-muted mt-1">
          Get AI help with your section
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Quick actions */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Quick Actions
            </p>
            <div className="space-y-1.5">
              {QUICK_ACTIONS.map((action) => (
                <Button
                  key={action.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction(action.id)}
                  disabled={isGenerating || (action.needsContent && !sectionHasContent)}
                  className="w-full justify-start gap-2 h-auto py-2"
                >
                  <action.icon className="h-3.5 w-3.5 shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-medium">{action.label}</div>
                    <div className="text-[10px] text-text-muted">{action.description}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* Custom prompt */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Custom Prompt
            </p>
            <div className="relative">
              <Textarea
                placeholder="Ask anything about this section..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCustomSubmit();
                  }
                }}
                className="pr-10 text-xs min-h-[60px] resize-none"
                disabled={isGenerating}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCustomSubmit}
                disabled={isGenerating || !customInput.trim()}
                className="absolute right-1 bottom-1 h-7 w-7"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Loading indicator */}
          {isGenerating && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-near-purple-500/10 border border-near-purple-500/20">
              <Loader2 className="h-4 w-4 text-near-purple-500 animate-spin" />
              <span className="text-xs text-text-muted">Generating...</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCancel}
                className="ml-auto h-6 w-6"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Error */}
          {aiError && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/20">
              <p className="text-xs text-error">{aiError}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="mt-1 text-xs h-6"
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Suggestion output */}
          {suggestion && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  {lastAction === 'review' ? 'Review' : 'Suggestion'}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClear}
                  className="h-6 w-6"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

              <div className="p-3 rounded-lg bg-surface/50 border border-border text-xs text-text-secondary whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                {suggestion}
              </div>

              {/* Inline replace confirmation */}
              {pendingInsert && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-text-secondary">This will replace your existing content.</p>
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleConfirmReplace}
                        className="text-xs h-6 border-warning/30 text-warning hover:bg-warning/10"
                      >
                        Replace
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelReplace}
                        className="text-xs h-6"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {lastAction !== 'review' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleInsertClick}
                    disabled={pendingInsert}
                    className="gap-1.5 text-xs"
                  >
                    <ArrowDownToLine className="h-3 w-3" />
                    Insert
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-1.5 text-xs"
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
