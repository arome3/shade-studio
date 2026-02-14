'use client';

/**
 * Team permissions management panel.
 * Card-based layout for managing team member access keys
 * on a project sub-account.
 */

import { useState, useCallback } from 'react';
import { UserPlus, Users, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PermissionSelector } from './permission-selector';
import { TeamMemberRow } from './team-member-row';
import { PERMISSION_CONFIGS, type PermissionLevel, type ProjectTeamMember } from '@/types/project-accounts';
import type { AddTeamMemberResult } from '@/types/project-accounts';

export interface TeamPermissionsProps {
  subAccountId: string;
  members: ProjectTeamMember[];
  currentAccountId: string;
  isAdding: boolean;
  onAddMember: (memberAccountId: string, permission: PermissionLevel) => Promise<AddTeamMemberResult>;
  onRevokeMember: (publicKey: string) => Promise<void>;
}

export function TeamPermissions({
  subAccountId,
  members,
  currentAccountId,
  isAdding,
  onAddMember,
  onRevokeMember,
}: TeamPermissionsProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMemberAccount, setNewMemberAccount] = useState('');
  const [newMemberPermission, setNewMemberPermission] =
    useState<PermissionLevel>('contributor');
  const [addResult, setAddResult] = useState<AddTeamMemberResult | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const isOwner = members.some(
    (m) => m.accountId === currentAccountId && m.permission === 'owner'
  );

  const handleAdd = useCallback(async () => {
    if (!newMemberAccount.trim()) return;

    setAddError(null);
    try {
      const result = await onAddMember(newMemberAccount.trim(), newMemberPermission);
      setAddResult(result);
      setNewMemberAccount('');
      setShowAddForm(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add member');
    }
  }, [newMemberAccount, newMemberPermission, onAddMember]);

  const handleDismissResult = useCallback(() => {
    setAddResult(null);
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Team Members
            <Badge variant="outline">{members.length}</Badge>
          </CardTitle>
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              disabled={isAdding}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add Member
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Add member form */}
          {showAddForm && (
            <div className="space-y-3 rounded-lg border border-border bg-background p-3">
              <div className="flex gap-2">
                <Input
                  placeholder="member-account.testnet"
                  value={newMemberAccount}
                  onChange={(e) => setNewMemberAccount(e.target.value)}
                  className="flex-1"
                />
                <PermissionSelector
                  value={newMemberPermission}
                  onValueChange={setNewMemberPermission}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setAddError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAdd}
                  loading={isAdding}
                  disabled={!newMemberAccount.trim() || isAdding}
                >
                  Add
                </Button>
              </div>
              {addError && (
                <p className="text-sm text-error">{addError}</p>
              )}
            </div>
          )}

          {/* Private key result (shown once) */}
          {addResult && addResult.privateKey && (
            <div className="space-y-2 rounded-lg border border-warning/50 bg-warning/10 p-3">
              <p className="text-sm font-medium text-warning">
                Share this private key with {addResult.member.accountId}
              </p>
              <p className="text-xs text-text-muted">
                This key will only be shown once. The member needs it to sign
                transactions on {subAccountId}.
              </p>
              <code className="block break-all rounded bg-background p-2 text-xs text-text-primary">
                {addResult.privateKey}
              </code>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(addResult.privateKey);
                  }}
                >
                  Copy Key
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDismissResult}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {/* Member list */}
          {members.length === 0 ? (
            <p className="py-4 text-center text-sm text-text-muted">
              No team members yet
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <TeamMemberRow
                  key={member.publicKey || member.accountId}
                  member={member}
                  isOwner={isOwner}
                  onRevoke={onRevokeMember}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permission legend */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 pb-3 text-sm font-medium text-text-primary">
            <Info className="h-4 w-4 text-text-muted" />
            Permission Levels
          </div>
          <div className="grid gap-2">
            {(Object.entries(PERMISSION_CONFIGS) as [PermissionLevel, typeof PERMISSION_CONFIGS[PermissionLevel]][]).map(
              ([level, config]) => (
                <div
                  key={level}
                  className="flex items-start gap-3 rounded-lg bg-surface-hover p-2"
                >
                  <Badge
                    variant={
                      level === 'owner'
                        ? 'default'
                        : level === 'editor'
                          ? 'secondary'
                          : 'outline'
                    }
                    className="mt-0.5 shrink-0"
                  >
                    {config.label}
                  </Badge>
                  <p className="text-xs text-text-muted">{config.description}</p>
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
