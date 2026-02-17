/**
 * AI Store
 *
 * Manages AI chat state including messages, settings, and conversation history.
 * Uses Zustand with devtools and persist middleware.
 *
 * Privacy note: Conversation messages are NOT persisted by default to protect
 * user privacy. Only settings (model, temperature, persona) are persisted.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  ChatMessage,
  SystemPromptType,
  NEARAIAttestation,
  NEARAIModelId,
} from '@/types/ai';

// ============================================================================
// Types
// ============================================================================

/** Conversation record for history */
export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  persona: SystemPromptType;
  createdAt: string;
  updatedAt: string;
}

/** AI store state */
export interface AIState {
  /** Current conversation messages */
  messages: ChatMessage[];
  /** Whether AI is currently generating */
  isLoading: boolean;
  /** Current error message */
  error: string | null;
  /** Selected AI persona */
  persona: SystemPromptType;
  /** Document IDs to include in context */
  contextDocumentIds: string[];
  /** Selected AI model */
  model: NEARAIModelId;
  /** Generation temperature (0-2) */
  temperature: number;
  /** Conversation history (Map-like structure for JSON serialization) */
  conversationHistory: Record<string, Conversation>;
  /** Active conversation ID */
  activeConversationId: string | null;
  /** Last attestation received */
  lastAttestation: NEARAIAttestation | null;
}

/** AI store actions */
export interface AIActions {
  // Message actions
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;

  // Loading/error actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

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
  loadConversation: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => void;
  renameConversation: (conversationId: string, title: string) => void;

  // Attestation
  setLastAttestation: (attestation: NEARAIAttestation | null) => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: AIState = {
  messages: [],
  isLoading: false,
  error: null,
  persona: 'grantWriter',
  contextDocumentIds: [],
  model: 'deepseek-ai/DeepSeek-V3.1',
  temperature: 0.7,
  conversationHistory: {},
  activeConversationId: null,
  lastAttestation: null,
};

// ============================================================================
// Store
// ============================================================================

/**
 * AI store combining state and actions.
 * Manages AI chat state with persistence for settings only.
 */
export const useAIStore = create<AIState & AIActions>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Message actions
        addMessage: (message: ChatMessage) =>
          set(
            (state) => ({
              messages: [...state.messages, message],
            }),
            false,
            'addMessage'
          ),

        updateMessage: (id: string, updates: Partial<ChatMessage>) =>
          set(
            (state) => ({
              messages: state.messages.map((msg) =>
                msg.id === id ? { ...msg, ...updates } : msg
              ),
            }),
            false,
            'updateMessage'
          ),

        removeMessage: (id: string) =>
          set(
            (state) => ({
              messages: state.messages.filter((msg) => msg.id !== id),
            }),
            false,
            'removeMessage'
          ),

        clearMessages: () =>
          set(
            {
              messages: [],
              activeConversationId: null,
              lastAttestation: null,
            },
            false,
            'clearMessages'
          ),

        // Loading/error actions
        setLoading: (loading: boolean) =>
          set({ isLoading: loading }, false, 'setLoading'),

        setError: (error: string | null) =>
          set({ error, isLoading: false }, false, 'setError'),

        clearError: () =>
          set({ error: null }, false, 'clearError'),

        // Settings actions
        setPersona: (persona: SystemPromptType) =>
          set({ persona }, false, 'setPersona'),

        setModel: (model: NEARAIModelId) =>
          set({ model }, false, 'setModel'),

        setTemperature: (temperature: number) =>
          set(
            { temperature: Math.max(0, Math.min(2, temperature)) },
            false,
            'setTemperature'
          ),

        // Context actions
        setContextDocuments: (documentIds: string[]) =>
          set({ contextDocumentIds: documentIds }, false, 'setContextDocuments'),

        addContextDocument: (documentId: string) =>
          set(
            (state) => ({
              contextDocumentIds: state.contextDocumentIds.includes(documentId)
                ? state.contextDocumentIds
                : [...state.contextDocumentIds, documentId],
            }),
            false,
            'addContextDocument'
          ),

        removeContextDocument: (documentId: string) =>
          set(
            (state) => ({
              contextDocumentIds: state.contextDocumentIds.filter(
                (id) => id !== documentId
              ),
            }),
            false,
            'removeContextDocument'
          ),

        clearContextDocuments: () =>
          set({ contextDocumentIds: [] }, false, 'clearContextDocuments'),

        // Conversation actions
        startNewConversation: (title?: string) => {
          const id = crypto.randomUUID();

          set(
            {
              messages: [],
              activeConversationId: id,
              error: null,
              lastAttestation: null,
            },
            false,
            'startNewConversation'
          );

          // Optionally save immediately with a title
          if (title) {
            get().saveConversation(title);
          }

          return id;
        },

        saveConversation: (title?: string) => {
          const state = get();
          const { messages, persona, activeConversationId } = state;

          if (messages.length === 0) return;

          const id = activeConversationId || crypto.randomUUID();
          const now = new Date().toISOString();

          // Generate title from first user message if not provided
          const conversationTitle =
            title ||
            state.conversationHistory[id]?.title ||
            messages.find((m) => m.role === 'user')?.content.slice(0, 50) ||
            'Untitled Conversation';

          const conversation: Conversation = {
            id,
            title: conversationTitle,
            messages,
            persona,
            createdAt: state.conversationHistory[id]?.createdAt || now,
            updatedAt: now,
          };

          set(
            (state) => ({
              conversationHistory: {
                ...state.conversationHistory,
                [id]: conversation,
              },
              activeConversationId: id,
            }),
            false,
            'saveConversation'
          );
        },

        loadConversation: (conversationId: string) => {
          const conversation = get().conversationHistory[conversationId];
          if (!conversation) return;

          set(
            {
              messages: conversation.messages,
              persona: conversation.persona,
              activeConversationId: conversationId,
              error: null,
              isLoading: false,
            },
            false,
            'loadConversation'
          );
        },

        deleteConversation: (conversationId: string) =>
          set(
            (state) => {
              const { [conversationId]: deleted, ...rest } =
                state.conversationHistory;

              return {
                conversationHistory: rest,
                // Clear current conversation if it was the deleted one
                ...(state.activeConversationId === conversationId
                  ? {
                      messages: [],
                      activeConversationId: null,
                    }
                  : {}),
              };
            },
            false,
            'deleteConversation'
          ),

        renameConversation: (conversationId: string, title: string) =>
          set(
            (state) => {
              const conversation = state.conversationHistory[conversationId];
              if (!conversation) return state;

              return {
                conversationHistory: {
                  ...state.conversationHistory,
                  [conversationId]: {
                    ...conversation,
                    title,
                    updatedAt: new Date().toISOString(),
                  },
                },
              };
            },
            false,
            'renameConversation'
          ),

        // Attestation
        setLastAttestation: (attestation: NEARAIAttestation | null) =>
          set({ lastAttestation: attestation }, false, 'setLastAttestation'),

        // Reset
        reset: () => set(initialState, false, 'reset'),
      }),
      {
        name: 'ai-store',
        version: 1,
        // Only persist settings, not messages (for privacy)
        partialize: (state) => ({
          persona: state.persona,
          model: state.model,
          temperature: state.temperature,
          // Persist conversation history (user can clear it)
          conversationHistory: state.conversationHistory,
        }),
        // Migrate stale model IDs from retired NEAR AI catalog
        migrate: (persisted, version) => {
          const state = persisted as Record<string, unknown>;
          if (version === 0) {
            const validModels = new Set([
              'deepseek-ai/DeepSeek-V3.1',
              'Qwen/Qwen3-30B-A3B-Instruct-2507',
              'openai/gpt-oss-120b',
            ]);
            if (state.model && !validModels.has(state.model as string)) {
              state.model = 'deepseek-ai/DeepSeek-V3.1';
            }
          }
          return state;
        },
      }
    ),
    {
      name: 'ai-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

/**
 * Get all messages in current conversation.
 */
export const useAIMessages = () =>
  useAIStore((state) => state.messages);

/**
 * Get the last message in the conversation.
 */
export const useLastMessage = () =>
  useAIStore((state) =>
    state.messages.length > 0
      ? state.messages[state.messages.length - 1]
      : null
  );

/**
 * Get the last assistant message.
 */
export const useLastAssistantMessage = () =>
  useAIStore((state) =>
    [...state.messages].reverse().find((m) => m.role === 'assistant') || null
  );

/**
 * Check if AI is currently loading.
 */
export const useAILoading = () =>
  useAIStore((state) => state.isLoading);

/**
 * Get the current error.
 */
export const useAIError = () =>
  useAIStore((state) => state.error);

/**
 * Get the current persona.
 */
export const useAIPersona = () =>
  useAIStore((state) => state.persona);

/**
 * Get the current model.
 */
export const useAIModel = () =>
  useAIStore((state) => state.model);

/**
 * Get the current temperature.
 */
export const useAITemperature = () =>
  useAIStore((state) => state.temperature);

/**
 * Get context document IDs.
 */
export const useContextDocumentIds = () =>
  useAIStore((state) => state.contextDocumentIds);

/**
 * Get all conversations from history.
 */
export const useConversationHistory = () =>
  useAIStore((state) => Object.values(state.conversationHistory));

/**
 * Get conversations sorted by date (newest first).
 */
export const useConversationHistorySorted = () =>
  useAIStore((state) =>
    Object.values(state.conversationHistory).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  );

/**
 * Get the active conversation ID.
 */
export const useActiveConversationId = () =>
  useAIStore((state) => state.activeConversationId);

/**
 * Get the last attestation.
 */
export const useLastAttestation = () =>
  useAIStore((state) => state.lastAttestation);

/**
 * Check if there are any messages.
 */
export const useHasMessages = () =>
  useAIStore((state) => state.messages.length > 0);

/**
 * Get message count.
 */
export const useMessageCount = () =>
  useAIStore((state) => state.messages.length);
