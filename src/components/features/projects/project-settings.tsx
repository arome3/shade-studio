'use client';

/**
 * Project settings page composing sub-account management.
 *
 * Guard cascade: !isConnected → isLoading → error → empty → content
 */

import { useState, useCallback, useEffect } from 'react';
import {
  KeyRound,
  Wallet,
  Clock,
  ExternalLink,
  ChevronDown,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useWallet } from '@/hooks/use-wallet';
import { useProjectAccount } from '@/hooks/use-project-account';
import { getExplorerAccountUrl } from '@/lib/near/config';
import { CreateProjectDialog } from './create-project-dialog';
import { TeamPermissions } from './team-permissions';

export interface ProjectSettingsProps {
  projectId: string;
}

export function ProjectSettings({ projectId }: ProjectSettingsProps) {
  const { isConnected, accountId } = useWallet();
  const {
    status,
    subAccount,
    teamMembers,
    accessKeys,
    error,
    isLoading,
    createSubAccount,
    checkSubAccountExists,
    addTeamMember,
    revokeTeamMember,
    refreshAccessKeys,
    validateSubAccountName,
  } = useProjectAccount(projectId);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);

  // Refresh keys when sub-account exists
  useEffect(() => {
    if (subAccount?.accountId && subAccount.isCreated) {
      refreshAccessKeys(subAccount.accountId);
    }
  }, [subAccount?.accountId, subAccount?.isCreated, refreshAccessKeys]);

  // ---- Handlers ----

  const handleAddMember = useCallback(
    async (memberAccountId: string, permission: 'owner' | 'editor' | 'contributor' | 'viewer') => {
      if (!subAccount) throw new Error('No sub-account');
      return addTeamMember({
        subAccountId: subAccount.accountId,
        memberAccountId,
        permission,
      });
    },
    [subAccount, addTeamMember]
  );

  const handleRevokeMember = useCallback(
    async (publicKey: string) => {
      if (!subAccount) return;
      await revokeTeamMember(subAccount.accountId, publicKey);
    },
    [subAccount, revokeTeamMember]
  );

  const handleRefresh = useCallback(() => {
    if (subAccount?.accountId) {
      refreshAccessKeys(subAccount.accountId);
    }
  }, [subAccount?.accountId, refreshAccessKeys]);

  // ---- Guard cascade ----

  if (!isConnected || !accountId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Wallet className="h-8 w-8 text-text-muted" />
          <p className="mt-3 text-sm text-text-muted">
            Connect your wallet to manage project settings
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-text-muted" />
          <p className="mt-3 text-sm text-text-muted">
            Loading sub-account data...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-error">{error.message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={handleRefresh}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ---- No sub-account yet ----

  if (!subAccount) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Project Sub-Account
            </CardTitle>
            <CardDescription>
              Create a dedicated NEAR account for this project with team access
              key management.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setCreateDialogOpen(true)}>
              Create Sub-Account
            </Button>
          </CardContent>
        </Card>

        <CreateProjectDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          projectId={projectId}
          parentAccountId={accountId}
          onValidateName={validateSubAccountName}
          onCheckExists={checkSubAccountExists}
          onCreate={createSubAccount}
        />
      </>
    );
  }

  // ---- Full settings view ----

  return (
    <div className="space-y-6">
      {/* Sub-account info card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              {subAccount.accountId}
            </CardTitle>
            <CardDescription>Project sub-account</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
            <span className="sr-only">Refresh</span>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-surface-hover p-3">
              <p className="text-xs text-text-muted">Initial Deposit</p>
              <p className="text-sm font-medium text-text-primary">
                {subAccount.initialDeposit} NEAR
              </p>
            </div>
            <div className="rounded-lg bg-surface-hover p-3">
              <p className="text-xs text-text-muted">Created</p>
              <p className="flex items-center gap-1 text-sm font-medium text-text-primary">
                <Clock className="h-3 w-3" />
                {new Date(subAccount.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="rounded-lg bg-surface-hover p-3">
              <p className="text-xs text-text-muted">Access Keys</p>
              <p className="text-sm font-medium text-text-primary">
                {accessKeys.length}
              </p>
            </div>
          </div>

          <a
            href={getExplorerAccountUrl(subAccount.accountId)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs text-near-green-500 hover:underline"
          >
            View on Explorer
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>

      {/* Team permissions */}
      <TeamPermissions
        subAccountId={subAccount.accountId}
        members={teamMembers}
        currentAccountId={accountId}
        isAdding={status === 'adding-member'}
        onAddMember={handleAddMember}
        onRevokeMember={handleRevokeMember}
      />

      {/* Danger zone */}
      <Collapsible open={dangerOpen} onOpenChange={setDangerOpen}>
        <Card className="border-error/30">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <CardTitle className="flex items-center justify-between text-base text-error">
                <span className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Danger Zone
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${dangerOpen ? 'rotate-180' : ''}`}
                />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <p className="text-sm text-text-muted">
                Deleting a sub-account requires transferring all remaining
                balance and revoking all access keys. This action cannot be
                undone.
              </p>
              <Button variant="destructive" size="sm" className="mt-3" disabled>
                Delete Sub-Account
              </Button>
              <p className="mt-1 text-xs text-text-muted">
                Account deletion is not yet supported.
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
