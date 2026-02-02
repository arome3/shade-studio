'use client';

import {
  FileText,
  TrendingUp,
  DollarSign,
  Sparkles,
  Search,
  Target,
  BarChart3,
  Flag,
  AlertTriangle,
  Lightbulb,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PROMPT_SUGGESTIONS } from '@/lib/ai/prompts';
import type { PromptSuggestion } from '@/types/ai';

export interface PromptSuggestionsProps {
  /** Called when a suggestion is selected */
  onSelect: (prompt: string) => void;
  /** Filter suggestions by category */
  category?: PromptSuggestion['category'];
  /** Maximum number of suggestions to show */
  maxSuggestions?: number;
}

/** Map icon names to components */
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  TrendingUp,
  DollarSign,
  Sparkles,
  Search,
  Target,
  BarChart3,
  Flag,
  AlertTriangle,
  Lightbulb,
  HelpCircle,
};

/**
 * Quick action prompt suggestions for the AI chat.
 * Displays preset prompts that users can click to quickly send.
 */
export function PromptSuggestions({
  onSelect,
  category,
  maxSuggestions = 6,
}: PromptSuggestionsProps) {
  // Filter and limit suggestions
  const suggestions = PROMPT_SUGGESTIONS.filter((s) => {
    if (category && s.category !== category) return false;
    // Skip "ask a question" placeholder
    if (!s.prompt) return false;
    return true;
  }).slice(0, maxSuggestions);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">Quick actions</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {suggestions.map((suggestion) => {
          const Icon = suggestion.icon ? ICONS[suggestion.icon] : HelpCircle;

          return (
            <Button
              key={suggestion.id}
              variant="outline"
              className="h-auto py-3 px-4 justify-start text-left"
              onClick={() => onSelect(suggestion.prompt)}
            >
              {Icon && (
                <Icon className="h-4 w-4 mr-3 shrink-0 text-near-green-500" />
              )}
              <span className="text-sm">{suggestion.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
