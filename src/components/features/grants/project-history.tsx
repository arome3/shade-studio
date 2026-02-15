'use client';

import { Globe, Users, TrendingUp, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { BadgeProps } from '@/components/ui/badge';
import {
  APPLICATION_STATUS_DISPLAY,
  formatFunding,
  type GrantProject,
  type GrantApplication,
} from '@/types/grants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectHistoryProps {
  project: GrantProject;
  applications: GrantApplication[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectHistory({ project, applications }: ProjectHistoryProps) {
  return (
    <div className="space-y-6">
      {/* Project header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium text-text-primary">
            {project.name}
          </h3>
          {project.website && (
            <a
              href={project.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              <Globe className="h-4 w-4" />
            </a>
          )}
        </div>
        <p className="text-sm text-text-muted">{project.description}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="flex items-center gap-1.5 text-text-muted mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-xs">Total Funded</span>
          </div>
          <p className="text-lg font-semibold text-text-primary">
            {formatFunding(project.totalFunded)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="flex items-center gap-1.5 text-text-muted mb-1">
            <FileText className="h-3.5 w-3.5" />
            <span className="text-xs">Applications</span>
          </div>
          <p className="text-lg font-semibold text-text-primary">
            {project.applicationCount}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="flex items-center gap-1.5 text-text-muted mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-xs">Success Rate</span>
          </div>
          <p className="text-lg font-semibold text-text-primary">
            {project.successRate}%
          </p>
        </div>
      </div>

      {/* Team members */}
      {project.teamMembers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-text-muted">
            <Users className="h-4 w-4" />
            <span className="text-sm font-medium">Team</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {project.teamMembers.map((member) => (
              <div
                key={member.accountId}
                className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5"
              >
                <div>
                  <span className="text-xs font-medium text-text-primary">
                    {member.name}
                  </span>
                  <span className="text-xs text-text-muted ml-1">
                    ({member.role})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Application timeline */}
      {applications.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-text-primary">
            Application History
          </h4>
          <div className="space-y-2">
            {applications.map((app) => {
              const statusDisplay = APPLICATION_STATUS_DISPLAY[app.status];
              return (
                <div
                  key={app.id}
                  className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary truncate">
                      {app.title}
                    </p>
                    <p className="text-xs text-text-muted">
                      Requested: {formatFunding(app.requestedAmount)}
                      {app.fundedAmount && (
                        <span className="text-success ml-2">
                          Funded: {formatFunding(app.fundedAmount)}
                        </span>
                      )}
                    </p>
                  </div>
                  <Badge
                    variant={statusDisplay.variant as BadgeProps['variant']}
                    className="text-[10px] shrink-0 ml-2"
                  >
                    {statusDisplay.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {applications.length === 0 && (
        <p className="text-sm text-text-muted text-center py-4">
          No applications submitted yet.
        </p>
      )}
    </div>
  );
}
