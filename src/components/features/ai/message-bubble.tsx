'use client';

import { useState } from 'react';
import { Copy, Check, User, Bot, FileText } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { AttestationBadge } from './attestation-badge';
import type { ChatMessage } from '@/types/ai';

export interface MessageBubbleProps {
  message: ChatMessage;
  /** Show context indicator */
  showContext?: boolean;
  /** Number of context documents */
  contextCount?: number;
}

/**
 * Individual message bubble in the chat interface.
 * Renders user and assistant messages with role-appropriate styling.
 */
export function MessageBubble({
  message,
  showContext = false,
  contextCount = 0,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        'group flex gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-near-green-500' : 'bg-surface-hover'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-near-black" />
        ) : (
          <Bot className="h-4 w-4 text-text-primary" />
        )}
      </div>

      {/* Message content */}
      <div
        className={cn(
          'flex max-w-[80%] flex-col gap-1',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        <div
          className={cn(
            'rounded-2xl px-4 py-2',
            isUser
              ? 'bg-near-green-500 text-near-black rounded-tr-sm'
              : 'bg-surface text-text-primary rounded-tl-sm'
          )}
        >
          {/* Message text */}
          <div className="whitespace-pre-wrap text-sm">
            {message.content}
            {message.isStreaming && (
              <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-current" />
            )}
          </div>
        </div>

        {/* Message footer */}
        <div
          className={cn(
            'flex items-center gap-2 text-xs text-text-muted',
            isUser ? 'flex-row-reverse' : 'flex-row'
          )}
        >
          {/* Timestamp */}
          <span>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>

          {/* Context indicator for user messages */}
          {isUser && showContext && contextCount > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-text-muted">
                    <FileText className="h-3 w-3" />
                    <span>{contextCount}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{contextCount} document(s) included in context</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Attestation badge for assistant messages */}
          {isAssistant && message.attestation && (
            <AttestationBadge attestation={message.attestation} />
          )}

          {/* Copy button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{copied ? 'Copied!' : 'Copy message'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
