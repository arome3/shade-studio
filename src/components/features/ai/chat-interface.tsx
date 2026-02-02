'use client';

import { useRef, useEffect, useState, type KeyboardEvent } from 'react';
import {
  Send,
  Square,
  RefreshCw,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './message-bubble';
import { PromptSuggestions } from './prompt-suggestions';
import type { ChatMessage } from '@/types/ai';

export interface ChatInterfaceProps {
  /** Chat messages to display */
  messages: ChatMessage[];
  /** Whether AI is currently generating */
  isLoading: boolean;
  /** Error message to display */
  error: string | null;
  /** Number of context documents */
  contextCount?: number;
  /** Whether chat is ready to use */
  isReady: boolean;
  /** Called when user sends a message */
  onSendMessage: (content: string) => Promise<void>;
  /** Called when user stops generation */
  onStopGeneration: () => void;
  /** Called when user wants to regenerate */
  onRegenerate: () => Promise<void>;
  /** Called when user clears conversation */
  onClearConversation: () => void;
}

/**
 * Main chat interface component for AI conversations.
 * Displays message history and input controls.
 */
export function ChatInterface({
  messages,
  isLoading,
  error,
  contextCount = 0,
  isReady,
  onSendMessage,
  onStopGeneration,
  onRegenerate,
  onClearConversation,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || isLoading || !isReady) return;

    setInput('');
    await onSendMessage(content);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionSelect = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const hasMessages = messages.length > 0;
  const lastMessage = messages[messages.length - 1];
  const canRegenerate =
    hasMessages && lastMessage?.role === 'assistant' && !isLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <ScrollArea
        ref={scrollRef}
        className="flex-1 p-4"
      >
        {!hasMessages ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-text-primary">
                AI Grant Assistant
              </h3>
              <p className="text-sm text-text-muted max-w-md">
                Get help writing, reviewing, and improving your grant proposals.
                Your conversations are processed in a secure TEE environment.
              </p>
            </div>

            <PromptSuggestions onSelect={handleSuggestionSelect} />
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                showContext={
                  message.role === 'user' && index === messages.length - 2
                }
                contextCount={contextCount}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Error display */}
      {error && (
        <div className="mx-4 mb-2 p-3 rounded-lg bg-error/10 border border-error/20 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-error shrink-0 mt-0.5" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border p-4 space-y-3">
        {/* Control buttons */}
        {hasMessages && (
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {isLoading ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onStopGeneration}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              ) : (
                canRegenerate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRegenerate}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>
                )
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearConversation}
              disabled={isLoading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isReady
                ? 'Type your message... (Enter to send, Shift+Enter for new line)'
                : 'Connect your wallet to use AI features'
            }
            disabled={!isReady || isLoading}
            className="min-h-[60px] max-h-[200px] resize-none"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !isReady}
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Hint */}
        <p className="text-xs text-text-muted text-center">
          AI responses are processed in a Trusted Execution Environment (TEE) for privacy
        </p>
      </div>
    </div>
  );
}
