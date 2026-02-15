'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Globe,
  Plus,
  RefreshCw,
  Wallet,
  AlertCircle,
  Loader2,
  Inbox,
  ArrowLeft,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useGrantRegistry } from '@/hooks/use-grant-registry';
import { ProgramSearch } from './program-search';
import { ProgramCard } from './program-card';
import { ProjectHistory } from './project-history';
import { EcosystemStats } from './ecosystem-stats';
import { RegisterProgramDialog } from './register-program-dialog';
import { RegisterProjectDialog } from './register-project-dialog';
import { RecordApplicationDialog } from './record-application-dialog';
import type { GrantProgram } from '@/types/grants';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GrantRegistryDashboard() {
  const {
    programs,
    projects,
    ecosystemStats,
    filters,
    applications,
    isFetching,
    error,
    isConnected,
    activeTab,
    selectedProjectId,
    search,
    updateFilters,
    registerNewProgram,
    registerNewProject,
    submitApplication,
    setActiveTab,
    setSelectedProjectId,
    refreshAll,
    clearError,
  } = useGrantRegistry();

  const [registerProgramOpen, setRegisterProgramOpen] = useState(false);
  const [registerProjectOpen, setRegisterProjectOpen] = useState(false);
  const [applyingProgram, setApplyingProgram] = useState<GrantProgram | null>(null);

  // --------------------------------------------------------------------------
  // Derived — selected project + its applications
  // --------------------------------------------------------------------------

  const selectedProject = useMemo(
    () => (selectedProjectId ? projects.find((p) => p.id === selectedProjectId) : null),
    [projects, selectedProjectId]
  );

  const selectedProjectApplications = useMemo(
    () => (selectedProjectId ? applications.filter((a) => a.projectId === selectedProjectId) : []),
    [applications, selectedProjectId]
  );

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  const handleRefresh = useCallback(() => {
    refreshAll();
  }, [refreshAll]);

  const handleApply = useCallback(
    (programId: string) => {
      const program = programs.find((p) => p.id === programId);
      if (program) setApplyingProgram(program);
    },
    [programs]
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
          Connect your NEAR wallet to browse grant programs, register projects,
          and track applications.
        </p>
      </div>
    );
  }

  // 2. Loading (with no data)
  if (isFetching && programs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-surface animate-pulse rounded" />
          <div className="h-8 w-24 bg-surface animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-surface animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // 3. Error (with no data)
  if (error && programs.length === 0) {
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

  // --------------------------------------------------------------------------
  // 4. Full content
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-text-muted" />
          <h1 className="text-xl font-semibold text-text-primary">
            Grant Registry
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
          <Button size="sm" onClick={() => setRegisterProgramOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Program
          </Button>
        </div>
      </div>

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
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
      >
        <TabsList>
          <TabsTrigger value="programs">
            Programs
            {programs.length > 0 && (
              <span className="ml-1.5 text-xs text-text-muted">
                ({programs.length})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="my-projects">
            My Projects
            {projects.length > 0 && (
              <span className="ml-1.5 text-xs text-text-muted">
                ({projects.length})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Programs Tab */}
        <TabsContent value="programs" className="mt-4 space-y-4">
          <ProgramSearch
            filters={filters}
            onFiltersChange={updateFilters}
            onSearch={search}
            disabled={isFetching}
          />

          {programs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="h-10 w-10 rounded-full bg-surface flex items-center justify-center">
                <Inbox className="h-5 w-5 text-text-muted" />
              </div>
              <p className="text-sm text-text-muted text-center">
                No grant programs found. Try adjusting your filters or register the first program.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRegisterProgramOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Register Program
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {programs.map((program) => (
                <ProgramCard
                  key={program.id}
                  program={program}
                  onApply={handleApply}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Projects Tab */}
        <TabsContent value="my-projects" className="mt-4">
          {selectedProject ? (
            /* Gap 3: Render ProjectHistory when a project is selected */
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setSelectedProjectId(null)}
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                Back to Projects
              </Button>
              <ProjectHistory
                project={selectedProject}
                applications={selectedProjectApplications}
              />
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="h-10 w-10 rounded-full bg-surface flex items-center justify-center">
                <Inbox className="h-5 w-5 text-text-muted" />
              </div>
              <p className="text-sm text-text-muted text-center">
                You haven&apos;t registered any projects yet.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRegisterProjectOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Register Project
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRegisterProjectOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Register Project
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className="rounded-lg border border-border bg-surface p-4 space-y-2 text-left hover:border-border/80 transition-colors cursor-pointer"
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    <h3 className="text-sm font-medium text-text-primary">
                      {project.name}
                    </h3>
                    <p className="text-xs text-text-muted line-clamp-2">
                      {project.description}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span>{project.applicationCount} applications</span>
                      <span>{project.successRate}% success</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-4">
          {ecosystemStats ? (
            <EcosystemStats stats={ecosystemStats} />
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-text-muted">
                Loading ecosystem analytics...
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <RegisterProgramDialog
        open={registerProgramOpen}
        onOpenChange={setRegisterProgramOpen}
        onRegister={registerNewProgram}
      />

      <RegisterProjectDialog
        open={registerProjectOpen}
        onOpenChange={setRegisterProjectOpen}
        onRegister={registerNewProject}
      />

      {/* Gap 1: Application dialog */}
      {applyingProgram && (
        <RecordApplicationDialog
          open={!!applyingProgram}
          onOpenChange={(open) => {
            if (!open) setApplyingProgram(null);
          }}
          onSubmit={submitApplication}
          program={applyingProgram}
          userProjects={projects}
        />
      )}
    </div>
  );
}
