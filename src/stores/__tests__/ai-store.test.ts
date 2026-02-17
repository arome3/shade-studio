import { describe, it, expect, beforeEach } from 'vitest';
import { useAIStore } from '../ai-store';
import type { ChatMessage, NEARAIAttestation } from '@/types/ai';

describe('ai-store', () => {
  beforeEach(() => {
    // Reset store before each test
    useAIStore.getState().reset();
  });

  describe('initial state', () => {
    it('should have empty messages', () => {
      expect(useAIStore.getState().messages).toEqual([]);
    });

    it('should not be loading', () => {
      expect(useAIStore.getState().isLoading).toBe(false);
    });

    it('should have no error', () => {
      expect(useAIStore.getState().error).toBeNull();
    });

    it('should have default persona', () => {
      expect(useAIStore.getState().persona).toBe('grantWriter');
    });

    it('should have default model', () => {
      expect(useAIStore.getState().model).toBe('deepseek-ai/DeepSeek-V3.1');
    });

    it('should have default temperature', () => {
      expect(useAIStore.getState().temperature).toBe(0.7);
    });
  });

  describe('message actions', () => {
    it('should add message', () => {
      const message: ChatMessage = {
        id: '1',
        role: 'user',
        content: 'Hello',
        createdAt: new Date().toISOString(),
      };

      useAIStore.getState().addMessage(message);

      expect(useAIStore.getState().messages).toHaveLength(1);
      expect(useAIStore.getState().messages[0]).toEqual(message);
    });

    it('should update message', () => {
      const message: ChatMessage = {
        id: '1',
        role: 'assistant',
        content: 'Hello',
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };

      useAIStore.getState().addMessage(message);
      useAIStore.getState().updateMessage('1', {
        content: 'Hello, how can I help?',
        isStreaming: false,
      });

      const updated = useAIStore.getState().messages[0]!;
      expect(updated.content).toBe('Hello, how can I help?');
      expect(updated.isStreaming).toBe(false);
    });

    it('should remove message', () => {
      useAIStore.getState().addMessage({
        id: '1',
        role: 'user',
        content: 'Hello',
        createdAt: new Date().toISOString(),
      });
      useAIStore.getState().addMessage({
        id: '2',
        role: 'assistant',
        content: 'Hi',
        createdAt: new Date().toISOString(),
      });

      useAIStore.getState().removeMessage('1');

      expect(useAIStore.getState().messages).toHaveLength(1);
      expect(useAIStore.getState().messages[0]!.id).toBe('2');
    });

    it('should clear messages', () => {
      useAIStore.getState().addMessage({
        id: '1',
        role: 'user',
        content: 'Hello',
        createdAt: new Date().toISOString(),
      });

      useAIStore.getState().clearMessages();

      expect(useAIStore.getState().messages).toHaveLength(0);
      expect(useAIStore.getState().activeConversationId).toBeNull();
    });
  });

  describe('loading and error states', () => {
    it('should set loading', () => {
      useAIStore.getState().setLoading(true);
      expect(useAIStore.getState().isLoading).toBe(true);

      useAIStore.getState().setLoading(false);
      expect(useAIStore.getState().isLoading).toBe(false);
    });

    it('should set error and clear loading', () => {
      useAIStore.getState().setLoading(true);
      useAIStore.getState().setError('Something went wrong');

      expect(useAIStore.getState().error).toBe('Something went wrong');
      expect(useAIStore.getState().isLoading).toBe(false);
    });

    it('should clear error', () => {
      useAIStore.getState().setError('Error');
      useAIStore.getState().clearError();

      expect(useAIStore.getState().error).toBeNull();
    });
  });

  describe('settings actions', () => {
    it('should set persona', () => {
      useAIStore.getState().setPersona('documentReviewer');
      expect(useAIStore.getState().persona).toBe('documentReviewer');
    });

    it('should set model', () => {
      useAIStore.getState().setModel('Qwen/Qwen3-30B-A3B-Instruct-2507');
      expect(useAIStore.getState().model).toBe('Qwen/Qwen3-30B-A3B-Instruct-2507');
    });

    it('should set temperature', () => {
      useAIStore.getState().setTemperature(0.5);
      expect(useAIStore.getState().temperature).toBe(0.5);
    });

    it('should clamp temperature to valid range', () => {
      useAIStore.getState().setTemperature(-1);
      expect(useAIStore.getState().temperature).toBe(0);

      useAIStore.getState().setTemperature(3);
      expect(useAIStore.getState().temperature).toBe(2);
    });
  });

  describe('context document actions', () => {
    it('should set context documents', () => {
      useAIStore.getState().setContextDocuments(['doc1', 'doc2']);
      expect(useAIStore.getState().contextDocumentIds).toEqual(['doc1', 'doc2']);
    });

    it('should add context document', () => {
      useAIStore.getState().addContextDocument('doc1');
      useAIStore.getState().addContextDocument('doc2');

      expect(useAIStore.getState().contextDocumentIds).toEqual(['doc1', 'doc2']);
    });

    it('should not add duplicate context document', () => {
      useAIStore.getState().addContextDocument('doc1');
      useAIStore.getState().addContextDocument('doc1');

      expect(useAIStore.getState().contextDocumentIds).toEqual(['doc1']);
    });

    it('should remove context document', () => {
      useAIStore.getState().setContextDocuments(['doc1', 'doc2', 'doc3']);
      useAIStore.getState().removeContextDocument('doc2');

      expect(useAIStore.getState().contextDocumentIds).toEqual(['doc1', 'doc3']);
    });

    it('should clear context documents', () => {
      useAIStore.getState().setContextDocuments(['doc1', 'doc2']);
      useAIStore.getState().clearContextDocuments();

      expect(useAIStore.getState().contextDocumentIds).toEqual([]);
    });
  });

  describe('conversation actions', () => {
    it('should start new conversation', () => {
      useAIStore.getState().addMessage({
        id: '1',
        role: 'user',
        content: 'Hello',
        createdAt: new Date().toISOString(),
      });

      const newId = useAIStore.getState().startNewConversation();

      expect(useAIStore.getState().messages).toHaveLength(0);
      expect(useAIStore.getState().activeConversationId).toBe(newId);
    });

    it('should save conversation', () => {
      useAIStore.getState().addMessage({
        id: '1',
        role: 'user',
        content: 'Hello',
        createdAt: new Date().toISOString(),
      });

      useAIStore.getState().saveConversation('Test Conversation');

      const history = Object.values(useAIStore.getState().conversationHistory);
      expect(history).toHaveLength(1);
      expect(history[0]!.title).toBe('Test Conversation');
    });

    it('should load conversation', () => {
      // Create and save a conversation
      const message: ChatMessage = {
        id: '1',
        role: 'user',
        content: 'Hello',
        createdAt: new Date().toISOString(),
      };
      useAIStore.getState().addMessage(message);
      useAIStore.getState().saveConversation('Test');

      const savedId = useAIStore.getState().activeConversationId!;

      // Clear and load
      useAIStore.getState().clearMessages();
      useAIStore.getState().loadConversation(savedId);

      expect(useAIStore.getState().messages).toHaveLength(1);
      expect(useAIStore.getState().messages[0]!.content).toBe('Hello');
    });

    it('should delete conversation', () => {
      useAIStore.getState().addMessage({
        id: '1',
        role: 'user',
        content: 'Hello',
        createdAt: new Date().toISOString(),
      });
      useAIStore.getState().saveConversation('Test');

      const savedId = useAIStore.getState().activeConversationId!;
      useAIStore.getState().deleteConversation(savedId);

      expect(useAIStore.getState().conversationHistory[savedId]).toBeUndefined();
      expect(useAIStore.getState().messages).toHaveLength(0);
    });

    it('should rename conversation', () => {
      useAIStore.getState().addMessage({
        id: '1',
        role: 'user',
        content: 'Hello',
        createdAt: new Date().toISOString(),
      });
      useAIStore.getState().saveConversation('Original Title');

      const savedId = useAIStore.getState().activeConversationId!;
      useAIStore.getState().renameConversation(savedId, 'New Title');

      expect(useAIStore.getState().conversationHistory[savedId]!.title).toBe(
        'New Title'
      );
    });
  });

  describe('attestation', () => {
    it('should set last attestation', () => {
      const attestation: NEARAIAttestation = {
        version: '1.0',
        tee_type: 'intel-tdx',
        enclave_id: 'abc123',
        code_hash: 'hash123',
        timestamp: new Date().toISOString(),
        quote: 'quote',
      };

      useAIStore.getState().setLastAttestation(attestation);
      expect(useAIStore.getState().lastAttestation).toEqual(attestation);
    });

    it('should clear attestation', () => {
      useAIStore.getState().setLastAttestation({
        version: '1.0',
        tee_type: 'intel-tdx',
        enclave_id: 'abc123',
        code_hash: 'hash123',
        timestamp: new Date().toISOString(),
        quote: 'quote',
      });

      useAIStore.getState().setLastAttestation(null);
      expect(useAIStore.getState().lastAttestation).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      // Modify state
      useAIStore.getState().addMessage({
        id: '1',
        role: 'user',
        content: 'Hello',
        createdAt: new Date().toISOString(),
      });
      useAIStore.getState().setLoading(true);
      useAIStore.getState().setError('Error');
      useAIStore.getState().setPersona('documentReviewer');
      useAIStore.getState().setTemperature(1.5);

      // Reset
      useAIStore.getState().reset();

      // Verify reset
      expect(useAIStore.getState().messages).toHaveLength(0);
      expect(useAIStore.getState().isLoading).toBe(false);
      expect(useAIStore.getState().error).toBeNull();
      expect(useAIStore.getState().persona).toBe('grantWriter');
      expect(useAIStore.getState().temperature).toBe(0.7);
    });
  });
});
