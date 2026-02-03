'use client';

import { useState } from 'react';
import { ChevronDown, LucideIcon } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

export interface BriefingSectionProps {
  /** Section title */
  title: string;
  /** Icon component to display */
  icon: LucideIcon;
  /** Optional badge content (e.g., count) */
  badge?: string | number;
  /** Badge variant */
  badgeVariant?: 'default' | 'secondary' | 'success' | 'warning' | 'error';
  /** Whether section starts open */
  defaultOpen?: boolean;
  /** Section content */
  children: React.ReactNode;
  /** Additional class names */
  className?: string;
}

/**
 * Reusable collapsible section for briefing content.
 * Features smooth animation, icon, and optional badge.
 *
 * @example
 * ```tsx
 * <BriefingSection
 *   title="Priority Actions"
 *   icon={AlertCircle}
 *   badge={5}
 *   badgeVariant="warning"
 * >
 *   <PriorityItemsList items={items} />
 * </BriefingSection>
 * ```
 */
export function BriefingSection({
  title,
  icon: Icon,
  badge,
  badgeVariant = 'secondary',
  defaultOpen = true,
  children,
  className,
}: BriefingSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn('border border-border rounded-lg', className)}
    >
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-surface/50 transition-colors rounded-t-lg group">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-near-green-500" />
          <span className="font-medium text-text-primary">{title}</span>
          {badge !== undefined && badge !== null && (
            <Badge variant={badgeVariant} className="text-xs">
              {badge}
            </Badge>
          )}
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-text-muted transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="p-4 pt-0 space-y-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
