'use client';

/**
 * Individual team member row for the permissions panel.
 * Shows avatar, account ID, permission badge, and action menu.
 */

import { useState } from 'react';
import { MoreHorizontal, Key, Shield, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatAccountId } from '@/lib/near/config';
import { PERMISSION_CONFIGS, type PermissionLevel, type ProjectTeamMember } from '@/types/project-accounts';

export interface TeamMemberRowProps {
  member: ProjectTeamMember;
  isOwner: boolean;
  onRevoke?: (publicKey: string) => void;
}

/** Map permission level to Badge variant */
function getPermissionBadgeVariant(
  permission: PermissionLevel
): 'default' | 'secondary' | 'outline' {
  switch (permission) {
    case 'owner':
      return 'default';
    case 'editor':
      return 'secondary';
    default:
      return 'outline';
  }
}

/** Map key status to visual indicator */
function getStatusColor(status: ProjectTeamMember['keyStatus']): string {
  switch (status) {
    case 'active':
      return 'bg-success';
    case 'pending':
      return 'bg-warning';
    case 'revoked':
      return 'bg-error';
  }
}

export function TeamMemberRow({
  member,
  isOwner,
  onRevoke,
}: TeamMemberRowProps) {
  const [revokeOpen, setRevokeOpen] = useState(false);

  const config = PERMISSION_CONFIGS[member.permission];
  const displayName = member.accountId || 'Unknown';
  const initial = displayName[0]?.toUpperCase() ?? '?';
  const canManage = isOwner && member.permission !== 'owner';

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-hover text-sm font-medium text-text-primary">
            {initial}
          </div>

          {/* Account info */}
          <div className="flex flex-col">
            <span className="text-sm font-medium text-text-primary">
              {formatAccountId(displayName, 24)}
            </span>
            <div className="flex items-center gap-2">
              <Badge variant={getPermissionBadgeVariant(member.permission)}>
                {config.label}
              </Badge>
              {member.publicKey && (
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${getStatusColor(member.keyStatus)}`}
                  title={`Key: ${member.keyStatus}`}
                />
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Member actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {member.publicKey && (
                <DropdownMenuItem
                  onClick={() => {
                    navigator.clipboard.writeText(member.publicKey!);
                  }}
                >
                  <Key className="mr-2 h-4 w-4" />
                  Copy Public Key
                </DropdownMenuItem>
              )}
              <DropdownMenuItem disabled>
                <Shield className="mr-2 h-4 w-4" />
                Change Permission
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-error focus:text-error"
                onClick={() => setRevokeOpen(true)}
              >
                <UserX className="mr-2 h-4 w-4" />
                Revoke Access
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Revoke confirmation */}
      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Revoke Access"
        description={`This will delete the access key for ${formatAccountId(displayName)}. They will no longer be able to sign transactions on this sub-account.`}
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={() => {
          if (member.publicKey && onRevoke) {
            onRevoke(member.publicKey);
          }
        }}
      />
    </>
  );
}
