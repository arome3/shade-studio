'use client';

import { useState, useCallback } from 'react';
import {
  Bot,
  Plus,
  RefreshCw,
  Wallet,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Inbox,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useShadeAgent } from '@/hooks/use-shade-agent';
import { AgentCard } from './agent-card';
import { TemplateCard } from './template-card';
import { DeployAgentDialog } from './deploy-agent-dialog';
import { RegisterTemplateDialog } from './register-template-dialog';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentDashboard() {
  const {
    templates,
    myAgents,
    orphanedDeploys,
    keyHealth,
    isFetching,
    error,
    isConnected,
    deploy,
    selectAgent,
    verify,
    invoke,
    cancelInvocation,
    deactivate,
    recoverOrphanedDeploy,
    dismissOrphanedDeploy,
    registerNewTemplate,
    refreshTemplates,
    refreshMyAgents,
    clearError,
  } = useShadeAgent();

  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [deployTemplateId, setDeployTemplateId] = useState<string | undefined>();
  const [registerTemplateOpen, setRegisterTemplateOpen] = useState(false);
  const [recoveringId, setRecoveringId] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  const handleDeploy = useCallback(
    async (templateId: string, name: string, slug: string) => {
      const result = await deploy(templateId, name, slug);
      if (result) {
        return { accountId: result.accountId };
      }
      return null;
    },
    [deploy]
  );

  const handleOpenDeploy = useCallback((templateId?: string) => {
    setDeployTemplateId(templateId);
    setDeployDialogOpen(true);
  }, []);

  const handleRefresh = useCallback(() => {
    refreshTemplates();
    refreshMyAgents();
  }, [refreshTemplates, refreshMyAgents]);

  const handleVerify = useCallback(
    (accountId: string) => {
      verify(accountId);
    },
    [verify]
  );

  const handleInvoke = useCallback(
    (accountId: string) => {
      invoke(accountId, 'default', {});
    },
    [invoke]
  );

  const handleDeactivate = useCallback(
    (accountId: string) => {
      deactivate(accountId);
    },
    [deactivate]
  );

  const handleRecover = useCallback(
    async (agentAccountId: string) => {
      setRecoveringId(agentAccountId);
      try {
        await recoverOrphanedDeploy(agentAccountId);
      } finally {
        setRecoveringId(null);
      }
    },
    [recoverOrphanedDeploy]
  );

  const handleDismissOrphan = useCallback(
    (agentAccountId: string) => {
      dismissOrphanedDeploy(agentAccountId);
    },
    [dismissOrphanedDeploy]
  );

  // --------------------------------------------------------------------------
  // Guard cascade: !isConnected → isFetching → error → empty → full content
  // --------------------------------------------------------------------------

  // 1. Not connected
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="h-12 w-12 rounded-full bg-surface flex items-center justify-center">
          <Wallet className="h-6 w-6 text-text-muted" />
        </div>
        <h2 className="text-lg font-medium text-text-primary">
          Connect Your Wallet
        </h2>
        <p className="text-sm text-text-muted text-center max-w-md">
          Connect your NEAR wallet to deploy and manage Shade Agents.
        </p>
      </div>
    );
  }

  // 2. Loading (with no data)
  if (isFetching && myAgents.length === 0 && templates.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-surface animate-pulse rounded" />
          <div className="h-8 w-24 bg-surface animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-surface animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // 3. Error (with no data)
  if (error && myAgents.length === 0 && templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="h-12 w-12 rounded-full bg-error/10 flex items-center justify-center">
          <AlertCircle className="h-6 w-6 text-error" />
        </div>
        <h2 className="text-lg font-medium text-text-primary">
          Something went wrong
        </h2>
        <p className="text-sm text-text-muted text-center max-w-md">
          {error}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Retry
          </Button>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  // 4. Empty state (no agents, no templates)
  const isEmpty = myAgents.length === 0 && templates.length === 0;
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="h-12 w-12 rounded-full bg-surface flex items-center justify-center">
          <Inbox className="h-6 w-6 text-text-muted" />
        </div>
        <h2 className="text-lg font-medium text-text-primary">
          No Agents Yet
        </h2>
        <p className="text-sm text-text-muted text-center max-w-md">
          The agent registry is empty. Check back later for available templates.
        </p>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 5. Full content
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-text-muted" />
          <h1 className="text-xl font-semibold text-text-primary">
            Shade Agents
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRegisterTemplateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Template
          </Button>
          <Button size="sm" onClick={() => handleOpenDeploy()}>
            <Plus className="h-4 w-4 mr-1" />
            Deploy Agent
          </Button>
        </div>
      </div>

      {/* Orphaned deployment recovery banner */}
      {orphanedDeploys.length > 0 && (
        <div className="p-3 rounded-md bg-warning/10 border border-warning/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm text-warning font-medium">
                {orphanedDeploys.length} agent deployment{orphanedDeploys.length > 1 ? 's' : ''} need{orphanedDeploys.length === 1 ? 's' : ''} recovery
              </p>
              {orphanedDeploys.map((orphan) => (
                <div key={orphan.agentAccountId} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-text-muted">{orphan.agentAccountId}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px]"
                      disabled={recoveringId === orphan.agentAccountId}
                      onClick={() => handleRecover(orphan.agentAccountId)}
                    >
                      {recoveringId === orphan.agentAccountId ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        'Recover'
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-text-muted"
                      onClick={() => handleDismissOrphan(orphan.agentAccountId)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error banner (with data) */}
      {error && (
        <div className="flex items-center justify-between p-3 rounded-md bg-error/10 border border-error/20">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-error shrink-0" />
            <p className="text-sm text-error">{error}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={clearError} className="text-xs">
            Dismiss
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="my-agents">
        <TabsList>
          <TabsTrigger value="my-agents">
            My Agents
            {myAgents.length > 0 && (
              <span className="ml-1.5 text-xs text-text-muted">
                ({myAgents.length})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="registry">
            Agent Registry
            {templates.length > 0 && (
              <span className="ml-1.5 text-xs text-text-muted">
                ({templates.length})
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-agents" className="mt-4">
          {myAgents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-text-muted">
                You haven&apos;t deployed any agents yet.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => handleOpenDeploy()}
              >
                <Plus className="h-4 w-4 mr-1" />
                Deploy Your First Agent
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myAgents.map((agent) => (
                <AgentCard
                  key={agent.accountId}
                  agent={agent}
                  keyHealth={keyHealth}
                  onVerify={handleVerify}
                  onInvoke={handleInvoke}
                  onCancelInvocation={cancelInvocation}
                  onDeactivate={handleDeactivate}
                  onSelect={selectAgent}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="registry" className="mt-4">
          {templates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-text-muted">
                No templates available in the registry.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onDeploy={handleOpenDeploy}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Deploy Dialog */}
      <DeployAgentDialog
        open={deployDialogOpen}
        onOpenChange={setDeployDialogOpen}
        templates={templates}
        initialTemplateId={deployTemplateId}
        onDeploy={handleDeploy}
      />

      {/* Register Template Dialog */}
      <RegisterTemplateDialog
        open={registerTemplateOpen}
        onOpenChange={setRegisterTemplateOpen}
        onRegister={registerNewTemplate}
      />
    </div>
  );
}
