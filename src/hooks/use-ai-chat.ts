'use client';

import { useCallback, useRef } from 'react';
import { useWallet } from './use-wallet';
import { useDocuments } from './use-documents';
import { useAIStore } from '@/stores/ai-store';
import {
  getAIClient,
  createContextualPrompt,
  buildContext,
  type ContextDocument,
} from '@/lib/ai';
import type {
  ChatMessage,
  MessageRole,
  SystemPromptType,
  NEARAIAttestation,
  NEARAIModelId,
} from '@/types/ai';

/**
 * Return type for the useAIChat hook.
 */
export interface UseAIChatReturn {
  // State
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  persona: SystemPromptType;
  model: NEARAIModelId;
  temperature: number;
  contextDocumentIds: string[];
  lastAttestation: NEARAIAttestation | null;
  isConnected: boolean;
  isReady: boolean;

  // Message actions
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;
  clearConversation: () => void;
  regenerate: () => Promise<void>;

  // Settings actions
  setPersona: (persona: SystemPromptType) => void;
  setModel: (model: NEARAIModelId) => void;
  setTemperature: (temperature: number) => void;

  // Context actions
  setContextDocuments: (documentIds: string[]) => void;
  addContextDocument: (documentId: string) => void;
  removeContextDocument: (documentId: string) => void;
  clearContextDocuments: () => void;

  // Conversation actions
  startNewConversation: (title?: string) => string;
  saveConversation: (title?: string) => void;
}

/**
 * Main AI chat hook for interacting with NEAR AI Cloud.
 * Combines the AI store with wallet authentication and document context.
 *
 * @param projectId - Optional project ID for context building
 *
 * @example
 * function ChatInterface({ projectId }) {
 *   const {
 *     messages,
 *     isLoading,
 *     sendMessage,
 *     stopGeneration,
 *   } = useAIChat(projectId);
 *
 *   const handleSend = async (text: string) => {
 *     await sendMessage(text);
 *   };
 *
 *   return (
 *     <div>
 *       {messages.map(msg => <Message key={msg.id} {...msg} />)}
 *       {isLoading && <LoadingIndicator />}
 *       <ChatInput onSend={handleSend} />
 *     </div>
 *   );
 * }
 */
export function useAIChat(projectId?: string): UseAIChatReturn {
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get wallet state for authentication
  const { isConnected, accountId, signMessage } = useWallet();

  // Get documents for context building
  const { documents, downloadDocument } = useDocuments(projectId);

  // Get AI store state and actions
  const messages = useAIStore((state) => state.messages);
  const isLoading = useAIStore((state) => state.isLoading);
  const error = useAIStore((state) => state.error);
  const persona = useAIStore((state) => state.persona);
  const model = useAIStore((state) => state.model);
  const temperature = useAIStore((state) => state.temperature);
  const contextDocumentIds = useAIStore((state) => state.contextDocumentIds);
  const lastAttestation = useAIStore((state) => state.lastAttestation);

  const addMessage = useAIStore((state) => state.addMessage);
  const updateMessage = useAIStore((state) => state.updateMessage);
  const removeMessage = useAIStore((state) => state.removeMessage);
  const clearMessages = useAIStore((state) => state.clearMessages);
  const setLoading = useAIStore((state) => state.setLoading);
  const setError = useAIStore((state) => state.setError);
  const clearError = useAIStore((state) => state.clearError);
  const setPersonaAction = useAIStore((state) => state.setPersona);
  const setModelAction = useAIStore((state) => state.setModel);
  const setTemperatureAction = useAIStore((state) => state.setTemperature);
  const setContextDocumentsAction = useAIStore((state) => state.setContextDocuments);
  const addContextDocumentAction = useAIStore((state) => state.addContextDocument);
  const removeContextDocumentAction = useAIStore((state) => state.removeContextDocument);
  const clearContextDocumentsAction = useAIStore((state) => state.clearContextDocuments);
  const setLastAttestation = useAIStore((state) => state.setLastAttestation);
  const startNewConversationAction = useAIStore((state) => state.startNewConversation);
  const saveConversationAction = useAIStore((state) => state.saveConversation);

  // Check if AI features are enabled
  const client = getAIClient();
  const isReady = isConnected && client.isEnabled();

  /**
   * Build context from selected documents.
   * Decrypts documents client-side for AI context.
   */
  const buildDocumentContext = useCallback(async (): Promise<ContextDocument[]> => {
    if (contextDocumentIds.length === 0) {
      return [];
    }

    const contextDocs: ContextDocument[] = [];

    for (const docId of contextDocumentIds) {
      const doc = documents.find((d) => d.id === docId);
      if (!doc) continue;

      try {
        // Download and decrypt the document
        const file = await downloadDocument(docId);
        const content = await file.text();

        contextDocs.push({
          id: doc.id,
          title: doc.metadata.name,
          type: doc.metadata.type,
          content,
          updatedAt: new Date(doc.metadata.updatedAt).toISOString(),
        });
      } catch (err) {
        console.warn(`Failed to load document ${docId} for context:`, err);
      }
    }

    return contextDocs;
  }, [contextDocumentIds, documents, downloadDocument]);

  /**
   * Set up authentication token for AI client.
   */
  const setupAuth = useCallback(async () => {
    if (!isConnected || !accountId) {
      return;
    }

    try {
      // Sign a message to prove wallet ownership
      const message = `NEAR AI Auth: ${Date.now()}`;
      const { signature } = await signMessage(message);
      client.setAuthToken(signature);
    } catch (err) {
      console.warn('Failed to set up AI auth:', err);
    }
  }, [isConnected, accountId, signMessage, client]);

  /**
   * Send a message and get AI response.
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;
      if (!isConnected) {
        setError('Please connect your wallet to use AI features');
        return;
      }

      // Clear any previous error
      clearError();

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      // Add user message
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: content.trim(),
        createdAt: new Date().toISOString(),
      };
      addMessage(userMessage);

      // Create assistant message placeholder
      const assistantMessageId = crypto.randomUUID();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };
      addMessage(assistantMessage);

      setLoading(true);

      try {
        // Set up authentication
        await setupAuth();

        // Build context from documents
        const contextDocs = await buildDocumentContext();
        const { contextString } = buildContext(contextDocs, undefined, {
          query: content,
          maxTokens: 3000,
        });

        // Create system prompt with context
        const systemPrompt = createContextualPrompt(persona, undefined, {
          content: contextString,
        });

        // Build message history for API
        const apiMessages: Array<{ role: MessageRole; content: string }> = [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          { role: 'user', content: content.trim() },
        ];

        // Stream the response
        await client.chatStream(
          apiMessages,
          {
            onToken: (token) => {
              updateMessage(assistantMessageId, {
                content:
                  (useAIStore.getState().messages.find((m) => m.id === assistantMessageId)
                    ?.content || '') + token,
              });
            },
            onComplete: (fullContent, attestation) => {
              updateMessage(assistantMessageId, {
                content: fullContent,
                isStreaming: false,
                attestation,
              });
              setLastAttestation(attestation ?? null);
              setLoading(false);
            },
            onError: (err) => {
              updateMessage(assistantMessageId, {
                content: 'Sorry, I encountered an error. Please try again.',
                isStreaming: false,
              });
              setError(err.message);
              setLoading(false);
            },
          },
          {
            model,
            temperature,
            abortController: abortControllerRef.current,
          }
        );
      } catch (err) {
        // Remove the empty assistant message on error
        removeMessage(assistantMessageId);
        setError(err instanceof Error ? err.message : 'Failed to send message');
        setLoading(false);
      }
    },
    [
      isConnected,
      messages,
      persona,
      model,
      temperature,
      client,
      setupAuth,
      buildDocumentContext,
      addMessage,
      updateMessage,
      removeMessage,
      setLoading,
      setError,
      clearError,
      setLastAttestation,
    ]
  );

  /**
   * Stop the current generation.
   */
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Update the last message to stop streaming
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.isStreaming) {
      updateMessage(lastMessage.id, { isStreaming: false });
    }

    setLoading(false);
  }, [messages, updateMessage, setLoading]);

  /**
   * Clear the conversation.
   */
  const clearConversation = useCallback(() => {
    stopGeneration();
    clearMessages();
    clearError();
  }, [stopGeneration, clearMessages, clearError]);

  /**
   * Regenerate the last assistant response.
   */
  const regenerate = useCallback(async () => {
    // Find the last user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage) return;

    // Find and remove the last assistant message
    const lastAssistantIndex = messages.findIndex(
      (m, i) => m.role === 'assistant' && !messages.slice(i + 1).some((mm) => mm.role === 'assistant')
    );
    if (lastAssistantIndex !== -1) {
      const msgToRemove = messages[lastAssistantIndex];
      if (msgToRemove) {
        removeMessage(msgToRemove.id);
      }
    }

    // Re-send the last user message
    await sendMessage(lastUserMessage.content);
  }, [messages, removeMessage, sendMessage]);

  /**
   * Set the AI persona.
   */
  const setPersona = useCallback(
    (newPersona: SystemPromptType) => {
      setPersonaAction(newPersona);
    },
    [setPersonaAction]
  );

  /**
   * Set the AI model.
   */
  const setModel = useCallback(
    (newModel: NEARAIModelId) => {
      setModelAction(newModel);
    },
    [setModelAction]
  );

  /**
   * Set the temperature.
   */
  const setTemperature = useCallback(
    (newTemperature: number) => {
      setTemperatureAction(newTemperature);
    },
    [setTemperatureAction]
  );

  /**
   * Set context documents.
   */
  const setContextDocuments = useCallback(
    (documentIds: string[]) => {
      setContextDocumentsAction(documentIds);
    },
    [setContextDocumentsAction]
  );

  /**
   * Add a context document.
   */
  const addContextDocument = useCallback(
    (documentId: string) => {
      addContextDocumentAction(documentId);
    },
    [addContextDocumentAction]
  );

  /**
   * Remove a context document.
   */
  const removeContextDocument = useCallback(
    (documentId: string) => {
      removeContextDocumentAction(documentId);
    },
    [removeContextDocumentAction]
  );

  /**
   * Clear all context documents.
   */
  const clearContextDocuments = useCallback(() => {
    clearContextDocumentsAction();
  }, [clearContextDocumentsAction]);

  /**
   * Start a new conversation.
   */
  const startNewConversation = useCallback(
    (title?: string) => {
      stopGeneration();
      return startNewConversationAction(title);
    },
    [stopGeneration, startNewConversationAction]
  );

  /**
   * Save the current conversation.
   */
  const saveConversation = useCallback(
    (title?: string) => {
      saveConversationAction(title);
    },
    [saveConversationAction]
  );

  return {
    // State
    messages,
    isLoading,
    error,
    persona,
    model,
    temperature,
    contextDocumentIds,
    lastAttestation,
    isConnected,
    isReady,

    // Message actions
    sendMessage,
    stopGeneration,
    clearConversation,
    regenerate,

    // Settings actions
    setPersona,
    setModel,
    setTemperature,

    // Context actions
    setContextDocuments,
    addContextDocument,
    removeContextDocument,
    clearContextDocuments,

    // Conversation actions
    startNewConversation,
    saveConversation,
  };
}
