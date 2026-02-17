'use client';

import { useState, useCallback, useRef } from 'react';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { CircuitSelector } from './circuit-selector';
import { ProofGenerationProgress } from './proof-generation-progress';
import { CIRCUIT_DISPLAY } from '@/lib/zk/circuit-display';
import {
  fetchVerifiedBuilderData,
  fetchGrantTrackRecordData,
  fetchTeamAttestationData,
} from '@/lib/zk/proof-data-fetcher';
import type { UseCredentialsReturn } from '@/hooks/use-credentials';
import type { ZKCircuit } from '@/types/zk';
import type { ProofOperation } from '@/stores/proof-store';

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

type WizardStep = 'select' | 'configure' | 'fetching-data' | 'generate' | 'complete';

// Default thresholds per circuit
const DEFAULT_THRESHOLDS: Record<ZKCircuit, number> = {
  'verified-builder': 30,
  'grant-track-record': 3,
  'team-attestation': 3,
};

const THRESHOLD_LABELS: Record<ZKCircuit, { label: string; unit: string; max: number }> = {
  'verified-builder': { label: 'Minimum Active Days', unit: 'days', max: 30 },
  'grant-track-record': { label: 'Minimum Completed Grants', unit: 'grants', max: 50 },
  'team-attestation': { label: 'Minimum Attestations', unit: 'attestations', max: 20 },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProofGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zkProof: UseCredentialsReturn['zkProof'];
  proofOperation: ProofOperation | null;
  onStoreOnChain?: (proofId: string) => void;
  accountId?: string | null;
}

export function ProofGenerationDialog({
  open,
  onOpenChange,
  zkProof,
  proofOperation,
  onStoreOnChain,
  accountId,
}: ProofGenerationDialogProps) {
  const [step, setStep] = useState<WizardStep>('select');
  const [selectedCircuit, setSelectedCircuit] = useState<ZKCircuit | null>(null);
  const [threshold, setThreshold] = useState(30);
  const [generatedProofId, setGeneratedProofId] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const resetWizard = useCallback(() => {
    setStep('select');
    setSelectedCircuit(null);
    setThreshold(30);
    setGeneratedProofId(null);
    setGenError(null);
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        // Don't close while generating or fetching
        if ((step === 'generate' && proofOperation) || step === 'fetching-data') {
          // Allow close but abort first
          if (abortRef.current) abortRef.current.abort();
        }
        resetWizard();
      }
      onOpenChange(isOpen);
    },
    [step, proofOperation, onOpenChange, resetWizard]
  );

  const handleSelectCircuit = useCallback(
    (circuit: ZKCircuit) => {
      setSelectedCircuit(circuit);
      setThreshold(DEFAULT_THRESHOLDS[circuit]);
    },
    []
  );

  const handleGenerate = useCallback(async () => {
    if (!selectedCircuit || !accountId) return;
    setGenError(null);

    // Step 1: Fetch on-chain data
    setStep('fetching-data');
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let proof;

      switch (selectedCircuit) {
        case 'verified-builder': {
          const data = await fetchVerifiedBuilderData(
            accountId ?? '',
            threshold,
            controller.signal
          );
          setStep('generate');
          proof = await zkProof.generateVerifiedBuilderProof(data);
          break;
        }
        case 'grant-track-record': {
          const data = await fetchGrantTrackRecordData(
            accountId ?? '',
            threshold,
            controller.signal
          );
          setStep('generate');
          proof = await zkProof.generateGrantTrackRecordProof(data);
          break;
        }
        case 'team-attestation': {
          const data = await fetchTeamAttestationData(
            accountId ?? '',
            threshold,
            controller.signal
          );
          setStep('generate');
          proof = await zkProof.generateTeamAttestationProof(data);
          break;
        }
      }

      setGeneratedProofId(proof.id);
      setStep('complete');
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || controller.signal.aborted)) {
        resetWizard();
        return;
      }
      setGenError(err instanceof Error ? err.message : 'Proof generation failed');
      setStep('configure');
    } finally {
      abortRef.current = null;
    }
  }, [selectedCircuit, threshold, accountId, zkProof, resetWizard]);

  // -------------------------------------------------------------------------
  // Render steps
  // -------------------------------------------------------------------------

  const renderSelectStep = () => (
    <>
      <DialogHeader>
        <DialogTitle>Generate ZK Credential</DialogTitle>
        <DialogDescription>
          Choose a credential type to generate a zero-knowledge proof.
        </DialogDescription>
      </DialogHeader>

      <CircuitSelector
        selected={selectedCircuit}
        onSelect={handleSelectCircuit}
      />

      <DialogFooter>
        <Button variant="outline" onClick={() => handleClose(false)}>
          Cancel
        </Button>
        <Button
          disabled={!selectedCircuit}
          onClick={() => setStep('configure')}
        >
          Next
        </Button>
      </DialogFooter>
    </>
  );

  const renderConfigureStep = () => {
    if (!selectedCircuit) return null;
    const info = THRESHOLD_LABELS[selectedCircuit];
    const display = CIRCUIT_DISPLAY[selectedCircuit];

    return (
      <>
        <DialogHeader>
          <DialogTitle>Configure {display.name}</DialogTitle>
          <DialogDescription>
            Set the threshold for your credential proof.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-text-primary">
                {info.label}
              </label>
              <span className="text-sm text-text-muted">
                {threshold} {info.unit}
              </span>
            </div>
            <Slider
              value={[threshold]}
              onValueChange={([val]) => val !== undefined && setThreshold(val)}
              min={1}
              max={info.max}
              step={1}
            />
          </div>

          {genError && (
            <div className="flex items-start gap-2 rounded-lg border border-error/20 bg-error/5 p-3">
              <AlertCircle className="h-4 w-4 text-error shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm text-error">{genError}</p>
                <Button variant="outline" size="sm" onClick={handleGenerate}>
                  Retry
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setStep('select')}>
            Back
          </Button>
          <Button onClick={handleGenerate} disabled={!accountId}>
            Generate Proof
          </Button>
        </DialogFooter>
      </>
    );
  };

  const renderFetchingDataStep = () => (
    <>
      <DialogHeader>
        <DialogTitle>Fetching On-Chain Data</DialogTitle>
        <DialogDescription>
          Gathering your activity data from the NEAR blockchain...
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col items-center py-8">
        <Loader2 className="h-10 w-10 animate-spin text-text-muted mb-4" />
        <p className="text-sm text-text-muted text-center">
          Querying indexer for your on-chain activity. This may take a few seconds.
        </p>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => {
            if (abortRef.current) abortRef.current.abort();
            resetWizard();
          }}
        >
          Cancel
        </Button>
      </DialogFooter>
    </>
  );

  const renderGenerateStep = () => {
    if (!proofOperation) return null;

    return (
      <>
        <DialogHeader>
          <DialogTitle>Generating Proof</DialogTitle>
          <DialogDescription>
            This may take up to a minute. The page may briefly freeze during computation.
          </DialogDescription>
        </DialogHeader>

        <ProofGenerationProgress
          operation={proofOperation}
          onCancel={() => {
            zkProof.cancelOperation();
            resetWizard();
          }}
        />
      </>
    );
  };

  const renderCompleteStep = () => (
    <>
      <DialogHeader>
        <DialogTitle>Proof Generated</DialogTitle>
        <DialogDescription>
          Your zero-knowledge proof has been successfully created.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col items-center py-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-near-green-500/10 mb-4">
          <CheckCircle2 className="h-8 w-8 text-near-green-500" />
        </div>
        <p className="text-sm text-text-muted text-center">
          Your credential is stored locally. You can optionally store it on the
          NEAR blockchain for permanent, verifiable proof.
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => handleClose(false)}>
          Done
        </Button>
        {generatedProofId && onStoreOnChain && (
          <Button onClick={() => {
            onStoreOnChain(generatedProofId);
            handleClose(false);
          }}>
            Store On-Chain
          </Button>
        )}
      </DialogFooter>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        {step === 'select' && renderSelectStep()}
        {step === 'configure' && renderConfigureStep()}
        {step === 'fetching-data' && renderFetchingDataStep()}
        {step === 'generate' && renderGenerateStep()}
        {step === 'complete' && renderCompleteStep()}
      </DialogContent>
    </Dialog>
  );
}
