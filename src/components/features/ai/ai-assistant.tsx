'use client';

import { useState } from 'react';
import {
  Bot,
  Settings,
  Shield,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ChatInterface } from './chat-interface';
import { ContextSelector } from './context-selector';
import { useAIChat } from '@/hooks/use-ai-chat';
import { useDocuments } from '@/hooks/use-documents';
import { useEncryption } from '@/hooks/use-encryption';
import {
  getPersonaDisplayName,
  getPersonaDescription,
} from '@/lib/ai/prompts';
import { AI_MODELS, type SystemPromptType, type NEARAIModelId } from '@/types/ai';

export interface AIAssistantProps {
  /** Project ID for context */
  projectId?: string;
}

const PERSONAS: SystemPromptType[] = [
  'grantWriter',
  'documentReviewer',
  'technicalWriter',
  'dailyBriefing',
  'competitiveAnalysis',
];

/**
 * Main AI Assistant container component.
 * Integrates chat interface with persona selection, context, and settings.
 */
export function AIAssistant({ projectId }: AIAssistantProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Get documents for context
  const { documents } = useDocuments(projectId);

  // Get encryption status
  const { isReady: isEncryptionReady } = useEncryption();

  // Get AI chat state and actions
  const {
    messages,
    isLoading,
    error,
    persona,
    model,
    temperature,
    contextDocumentIds,
    isConnected,
    isReady,
    sendMessage,
    stopGeneration,
    clearConversation,
    regenerate,
    setPersona,
    setModel,
    setTemperature,
    setContextDocuments,
  } = useAIChat(projectId);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="border-b border-border py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-near-green-500/10">
              <Bot className="h-5 w-5 text-near-green-500" />
            </div>
            <div>
              <CardTitle className="text-base">
                {getPersonaDisplayName(persona)}
              </CardTitle>
              <p className="text-xs text-text-muted">
                {getPersonaDescription(persona)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Privacy indicator */}
            <Badge variant="secondary" className="gap-1">
              <Shield className="h-3 w-3" />
              TEE Protected
            </Badge>

            {/* Settings button */}
            <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>AI Settings</SheetTitle>
                  <SheetDescription>
                    Configure the AI assistant behavior and context
                  </SheetDescription>
                </SheetHeader>

                <div className="space-y-6 mt-6">
                  {/* Persona selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">AI Persona</label>
                    <Select
                      value={persona}
                      onValueChange={(value) =>
                        setPersona(value as SystemPromptType)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select persona" />
                      </SelectTrigger>
                      <SelectContent>
                        {PERSONAS.map((p) => (
                          <SelectItem key={p} value={p}>
                            <div className="flex flex-col">
                              <span>{getPersonaDisplayName(p)}</span>
                              <span className="text-xs text-text-muted">
                                {getPersonaDescription(p)}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Model selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Model</label>
                    <Select
                      value={model}
                      onValueChange={(value) =>
                        setModel(value as NEARAIModelId)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_MODELS.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            <div className="flex flex-col">
                              <span>{m.name}</span>
                              <span className="text-xs text-text-muted">
                                {m.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Temperature slider */}
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <label className="text-sm font-medium">Temperature</label>
                      <span className="text-sm text-text-muted">
                        {temperature.toFixed(1)}
                      </span>
                    </div>
                    <Slider
                      value={[temperature]}
                      onValueChange={(values: number[]) => {
                        if (values[0] !== undefined) setTemperature(values[0]);
                      }}
                      min={0}
                      max={2}
                      step={0.1}
                    />
                    <p className="text-xs text-text-muted">
                      Lower values make responses more focused and deterministic.
                      Higher values increase creativity and variability.
                    </p>
                  </div>

                  {/* Context documents */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Context Documents
                    </label>
                    <ContextSelector
                      documents={documents}
                      selectedIds={contextDocumentIds}
                      onSelectionChange={setContextDocuments}
                      disabled={!isEncryptionReady}
                    />
                    {!isEncryptionReady && (
                      <p className="text-xs text-warning flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        Initialize encryption to add document context
                      </p>
                    )}
                  </div>

                  {/* Privacy info */}
                  <div className="p-3 rounded-lg bg-surface space-y-2">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-near-green-500" />
                      <span className="text-sm font-medium">
                        Privacy Protected
                      </span>
                    </div>
                    <p className="text-xs text-text-muted">
                      All AI inference runs in a Trusted Execution Environment
                      (TEE). Your prompts and documents are encrypted and cannot
                      be accessed by anyone, including NEAR AI operators.
                    </p>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 min-h-0">
        {/* Connection warning */}
        {!isConnected && (
          <div className="m-4 p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-warning">
                Wallet not connected
              </p>
              <p className="text-xs text-text-muted">
                Connect your NEAR wallet to use AI features
              </p>
            </div>
          </div>
        )}

        {/* Chat interface */}
        <ChatInterface
          messages={messages}
          isLoading={isLoading}
          error={error}
          contextCount={contextDocumentIds.length}
          isReady={isReady}
          onSendMessage={sendMessage}
          onStopGeneration={stopGeneration}
          onRegenerate={regenerate}
          onClearConversation={clearConversation}
        />
      </CardContent>
    </Card>
  );
}
