/**
 * Shade Agent Store
 *
 * Zustand v5 store for agent state. Intentionally has NO persist
 * middleware — agent instances reference encrypted keys (sensitive data).
 * On-chain state via RPC is the source of truth.
 *
 * Pattern follows project-accounts-store.ts for no-persist approach
 * and async-ai-store.ts for Record+Order normalization.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { AgentTemplate, AgentInstance } from '@/types/agents';

// ============================================================================
// State & Actions
// ============================================================================

export interface AgentState {
  /** Templates keyed by ID (stable reference for O(1) lookup) */
  templates: Record<string, AgentTemplate>;
  /** Template IDs in display order */
  templateOrder: string[];
  /** Agent instances keyed by account ID */
  instances: Record<string, AgentInstance>;
  /** Instance account IDs in display order */
  instanceOrder: string[];
  /** Currently selected agent account ID */
  activeAgentId: string | null;
  /** Whether data is being fetched */
  isFetching: boolean;
  /** Error message */
  error: string | null;
}

export interface AgentActions {
  setTemplates: (templates: AgentTemplate[]) => void;
  addTemplate: (template: AgentTemplate) => void;
  setInstances: (instances: AgentInstance[]) => void;
  addInstance: (instance: AgentInstance) => void;
  updateInstance: (accountId: string, partial: Partial<AgentInstance>) => void;
  removeInstance: (accountId: string) => void;
  setActiveAgent: (accountId: string | null) => void;
  setFetching: (fetching: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: AgentState = {
  templates: {},
  templateOrder: [],
  instances: {},
  instanceOrder: [],
  activeAgentId: null,
  isFetching: false,
  error: null,
};

// ============================================================================
// Store
// ============================================================================

export const useAgentStore = create<AgentState & AgentActions>()(
  devtools(
    (set) => ({
      ...initialState,

      setTemplates: (templates: AgentTemplate[]) =>
        set(
          () => {
            const record: Record<string, AgentTemplate> = {};
            const order: string[] = [];
            for (const t of templates) {
              record[t.id] = t;
              order.push(t.id);
            }
            return { templates: record, templateOrder: order };
          },
          false,
          'setTemplates'
        ),

      addTemplate: (template: AgentTemplate) =>
        set(
          (state) => ({
            templates: { ...state.templates, [template.id]: template },
            templateOrder: state.templateOrder.includes(template.id)
              ? state.templateOrder
              : [...state.templateOrder, template.id],
          }),
          false,
          'addTemplate'
        ),

      setInstances: (instances: AgentInstance[]) =>
        set(
          () => {
            const record: Record<string, AgentInstance> = {};
            const order: string[] = [];
            for (const inst of instances) {
              record[inst.accountId] = inst;
              order.push(inst.accountId);
            }
            return { instances: record, instanceOrder: order };
          },
          false,
          'setInstances'
        ),

      addInstance: (instance: AgentInstance) =>
        set(
          (state) => ({
            instances: { ...state.instances, [instance.accountId]: instance },
            instanceOrder: [instance.accountId, ...state.instanceOrder],
          }),
          false,
          'addInstance'
        ),

      updateInstance: (accountId: string, partial: Partial<AgentInstance>) =>
        set(
          (state) => {
            const existing = state.instances[accountId];
            if (!existing) return state;
            return {
              instances: {
                ...state.instances,
                [accountId]: { ...existing, ...partial },
              },
            };
          },
          false,
          'updateInstance'
        ),

      removeInstance: (accountId: string) =>
        set(
          (state) => {
            const { [accountId]: _, ...remaining } = state.instances;
            return {
              instances: remaining,
              instanceOrder: state.instanceOrder.filter((id) => id !== accountId),
              activeAgentId:
                state.activeAgentId === accountId ? null : state.activeAgentId,
            };
          },
          false,
          'removeInstance'
        ),

      setActiveAgent: (accountId: string | null) =>
        set({ activeAgentId: accountId }, false, 'setActiveAgent'),

      setFetching: (fetching: boolean) =>
        set(
          { isFetching: fetching, ...(fetching ? { error: null } : {}) },
          false,
          'setFetching'
        ),

      setError: (error: string | null) =>
        set({ error, isFetching: false }, false, 'setError'),

      clearError: () => set({ error: null }, false, 'clearError'),

      reset: () => set(initialState, false, 'reset'),
    }),
    {
      name: 'agent-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

// Stable empty arrays to prevent infinite re-render loops in Zustand v5 selectors.
const EMPTY_TEMPLATES: AgentTemplate[] = [];
const EMPTY_INSTANCES: AgentInstance[] = [];

/** Get the templates record. */
export const useAgentTemplates = () =>
  useAgentStore((state) => state.templates);

/** Get the template order array. */
export const useAgentTemplateOrder = () =>
  useAgentStore((state) =>
    state.templateOrder.length > 0 ? state.templateOrder : EMPTY_TEMPLATES.map((t) => t.id)
  );

/** Get the instances record. */
export const useAgentInstances = () =>
  useAgentStore((state) => state.instances);

/** Get the instance order array. */
export const useAgentInstanceOrder = () =>
  useAgentStore((state) =>
    state.instanceOrder.length > 0 ? state.instanceOrder : EMPTY_INSTANCES.map((i) => i.accountId)
  );

/** Get the active agent ID. */
export const useActiveAgentId = () =>
  useAgentStore((state) => state.activeAgentId);

/** Check if data is being fetched. */
export const useAgentsFetching = () =>
  useAgentStore((state) => state.isFetching);

/** Get the current error. */
export const useAgentsError = () =>
  useAgentStore((state) => state.error);
