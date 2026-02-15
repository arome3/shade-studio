#!/usr/bin/env npx tsx
/**
 * Async AI Worker Daemon
 *
 * Off-chain service that processes AI pipeline jobs submitted to the
 * async-ai-processor NEAR contract. Connects via near-api-js with
 * KeyPair credentials (not WalletSelector — that's browser-only).
 *
 * Usage:
 *   ASYNC_AI_WORKER_ACCOUNT_ID=worker.testnet \
 *   ASYNC_AI_WORKER_PRIVATE_KEY=ed25519:... \
 *   ASYNC_AI_CONTRACT_ID=async-ai.testnet \
 *   npx tsx scripts/async-ai-worker.ts
 *
 *   # Dry run (initialize + quit without processing):
 *   npx tsx scripts/async-ai-worker.ts --dry-run
 */

import * as nearAPI from 'near-api-js';
import type { KeyPairString } from 'near-api-js/lib/utils';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WORKER_ACCOUNT_ID = process.env.ASYNC_AI_WORKER_ACCOUNT_ID ?? '';
const WORKER_PRIVATE_KEY = process.env.ASYNC_AI_WORKER_PRIVATE_KEY ?? '';
const CONTRACT_ID = process.env.ASYNC_AI_CONTRACT_ID ?? 'async-ai.testnet';
const NETWORK_ID = process.env.NEAR_NETWORK_ID ?? 'testnet';
const AI_ENDPOINT = process.env.NEXT_PUBLIC_AI_ENDPOINT ?? 'https://ai.phala.network/v1';
const AI_API_KEY = process.env.AI_API_KEY ?? '';
const AI_MODEL = 'llama-3.3-70b-instruct';

const POLL_INTERVAL_MS = 5_000;
const TIMEOUT_CHECK_INTERVAL = 10; // Run timeout_stale_jobs every N polls
const MAX_CONSECUTIVE_ERRORS = 5;
const DRY_RUN = process.argv.includes('--dry-run');

const RPC_URLS: Record<string, string> = {
  testnet: 'https://rpc.testnet.near.org',
  mainnet: 'https://rpc.mainnet.near.org',
};

// ---------------------------------------------------------------------------
// NEAR Connection
// ---------------------------------------------------------------------------

interface ContractJob {
  id: string;
  job_type: string;
  owner: string;
  deposit: string;
  params: string;
  status: string;
  progress: number;
  checkpoint?: {
    progress: number;
    step: string;
    state: string;
    timestamp: number;
  };
  result?: string;
  error?: string;
  attestation?: string;
  created_at: number;
  updated_at: number;
  completed_at?: number;
  worker?: string;
}

async function connectNear(): Promise<{
  account: nearAPI.Account;
  contract: nearAPI.Contract;
}> {
  const keyStore = new nearAPI.keyStores.InMemoryKeyStore();
  const keyPair = nearAPI.KeyPair.fromString(WORKER_PRIVATE_KEY as KeyPairString);
  await keyStore.setKey(NETWORK_ID, WORKER_ACCOUNT_ID, keyPair);

  const near = await nearAPI.connect({
    networkId: NETWORK_ID,
    keyStore,
    nodeUrl: RPC_URLS[NETWORK_ID] ?? RPC_URLS.testnet!,
  });

  const account = await near.account(WORKER_ACCOUNT_ID);

  const contract = new nearAPI.Contract(account, CONTRACT_ID, {
    viewMethods: ['get_pending_count', 'get_config', 'get_job'],
    changeMethods: [
      'claim_job',
      'checkpoint_progress',
      'resume_job',
      'complete_job',
      'fail_job',
      'timeout_stale_jobs',
    ],
    useLocalViewExecution: false,
  });

  return { account, contract };
}

// ---------------------------------------------------------------------------
// AI Processing
// ---------------------------------------------------------------------------

interface AIResponse {
  content: string;
}

const SYSTEM_PROMPTS: Record<string, string> = {
  'document-analysis': `You are an expert document analyst for Web3/blockchain projects. Analyze the provided documents thoroughly. Return a JSON object with: { "type": "document-analysis", "data": { "summary": string, "keyFindings": string[], "recommendations": string[], "riskFactors": string[] }, "metadata": { "totalDuration": number, "checkpointCount": number, "tokensUsed": number } }`,
  'proposal-review': `You are a grant proposal reviewer specializing in Web3 projects. Evaluate the proposal against the specified grant program criteria. Return a JSON object with: { "type": "proposal-review", "data": { "score": number, "strengths": string[], "weaknesses": string[], "recommendations": string[], "alignment": string }, "metadata": { "totalDuration": number, "checkpointCount": number, "tokensUsed": number } }`,
  'competitive-research': `You are a competitive intelligence analyst for the blockchain/Web3 space. Research the target project against its competitors. Return a JSON object with: { "type": "competitive-research", "data": { "overview": string, "competitors": object[], "differentiators": string[], "threats": string[], "opportunities": string[] }, "metadata": { "totalDuration": number, "checkpointCount": number, "tokensUsed": number } }`,
  'grant-matching': `You are a grant matching specialist for Web3 projects. Match the project description to suitable grant programs. Return a JSON object with: { "type": "grant-matching", "data": { "matches": object[], "topRecommendation": string, "fitScore": number, "suggestions": string[] }, "metadata": { "totalDuration": number, "checkpointCount": number, "tokensUsed": number } }`,
  'weekly-synthesis': `You are a Web3 activity synthesizer. Create a comprehensive weekly summary for the specified account. Return a JSON object with: { "type": "weekly-synthesis", "data": { "summary": string, "highlights": string[], "metrics": object, "actionItems": string[] }, "metadata": { "totalDuration": number, "checkpointCount": number, "tokensUsed": number } }`,
};

async function callAI(systemPrompt: string, userPrompt: string): Promise<AIResponse> {
  const response = await fetch(`${AI_ENDPOINT}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(AI_API_KEY ? { Authorization: `Bearer ${AI_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  return { content };
}

/** Strip markdown code fences from AI response */
function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/m, '')
    .replace(/\n?```\s*$/m, '')
    .trim();
}

// ---------------------------------------------------------------------------
// Job Processing
// ---------------------------------------------------------------------------

interface ProcessingStep {
  prompt: string;
  checkpointStep: string;
  progress: number;
}

function getProcessingSteps(jobType: string, params: Record<string, unknown>): ProcessingStep[] {
  switch (jobType) {
    case 'document-analysis': {
      const docIds = (params.documentIds as string[]) ?? [];
      const steps: ProcessingStep[] = docIds.map((id, i) => ({
        prompt: `Analyze document "${id}" with ${params.depth ?? 'standard'} depth. Focus areas: ${(params.focusAreas as string[])?.join(', ') ?? 'general'}`,
        checkpointStep: `Analyzing document ${i + 1}/${docIds.length}: ${id}`,
        progress: Math.round(((i + 1) / (docIds.length + 1)) * 90),
      }));
      steps.push({
        prompt: `Synthesize findings from all ${docIds.length} documents into a final analysis.`,
        checkpointStep: 'Synthesizing final analysis',
        progress: 95,
      });
      return steps;
    }
    case 'proposal-review':
      return [
        {
          prompt: `Analyze proposal "${params.proposalId}" sections for grant program "${params.grantProgram}". Focus on technical merit, team capability, and budget.`,
          checkpointStep: 'Analyzing proposal sections',
          progress: 50,
        },
        {
          prompt: `Score the proposal overall and provide final recommendations. Include rubric: ${params.includeRubric ?? false}`,
          checkpointStep: 'Computing overall score',
          progress: 95,
        },
      ];
    case 'competitive-research': {
      const competitors = (params.competitors as string[]) ?? [];
      const steps: ProcessingStep[] = competitors.map((comp, i) => ({
        prompt: `Research competitor "${comp}" relative to target project "${params.targetProject}". Dimensions: ${(params.dimensions as string[])?.join(', ') ?? 'all'}`,
        checkpointStep: `Researching competitor ${i + 1}/${competitors.length}: ${comp}`,
        progress: Math.round(((i + 1) / (competitors.length + 1)) * 90),
      }));
      steps.push({
        prompt: `Compare all competitors against "${params.targetProject}" and provide strategic insights.`,
        checkpointStep: 'Generating competitive comparison',
        progress: 95,
      });
      return steps;
    }
    case 'grant-matching':
      return [
        {
          prompt: `Extract project profile from description: "${params.projectDescription}". Tech: ${(params.techStack as string[])?.join(', ') ?? 'not specified'}. Budget: ${JSON.stringify(params.budgetRange ?? 'flexible')}`,
          checkpointStep: 'Extracting project profile',
          progress: 30,
        },
        {
          prompt: `Match the project profile to available Web3 grant programs.`,
          checkpointStep: 'Matching to grant programs',
          progress: 70,
        },
        {
          prompt: `Rank matched grants by fit and provide application recommendations.`,
          checkpointStep: 'Ranking and recommendations',
          progress: 95,
        },
      ];
    case 'weekly-synthesis':
      return [
        {
          prompt: `Aggregate activity data for account "${params.accountId}" over the last ${params.days ?? 7} days.`,
          checkpointStep: 'Aggregating activity data',
          progress: 40,
        },
        {
          prompt: `Synthesize the activity data into a comprehensive weekly summary with highlights and action items.`,
          checkpointStep: 'Generating synthesis',
          progress: 95,
        },
      ];
    default:
      return [
        {
          prompt: `Process job with params: ${JSON.stringify(params)}`,
          checkpointStep: 'Processing',
          progress: 95,
        },
      ];
  }
}

async function processJob(
  contract: nearAPI.Contract,
  job: ContractJob,
): Promise<void> {
  const jobType = job.job_type;
  const systemPrompt = SYSTEM_PROMPTS[jobType] ?? SYSTEM_PROMPTS['document-analysis']!;

  let params: Record<string, unknown>;
  try {
    params = JSON.parse(job.params);
  } catch {
    params = {};
  }

  const steps = getProcessingSteps(jobType, params);
  let lastState = job.checkpoint?.state ?? '{}';
  const startTime = Date.now();
  let totalTokens = 0;
  let checkpointCount = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const isLastStep = i === steps.length - 1;

    log(`  Step ${i + 1}/${steps.length}: ${step.checkpointStep}`);

    const contextPrompt = `Previous context: ${lastState}\n\n${step.prompt}`;
    const aiResponse = await callAI(systemPrompt, contextPrompt);
    totalTokens += aiResponse.content.length; // Approximate

    const cleanContent = stripCodeFences(aiResponse.content);
    lastState = cleanContent;

    // Checkpoint intermediate steps (not the last one)
    if (!isLastStep) {
      checkpointCount++;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (contract as any).checkpoint_progress({
        args: {
          job_id: job.id,
          progress: step.progress,
          step: step.checkpointStep,
          state: cleanContent,
        },
        gas: '30000000000000',
      });
      log(`  Checkpoint saved: ${step.progress}%`);

      // Resume the job for the next step
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (contract as any).resume_job({
        args: { job_id: job.id },
        gas: '30000000000000',
      });
    }
  }

  // Build final result
  const duration = Date.now() - startTime;
  let resultObj: Record<string, unknown>;
  try {
    resultObj = JSON.parse(lastState);
  } catch {
    resultObj = {
      type: jobType,
      data: { raw: lastState },
      metadata: { totalDuration: duration, checkpointCount, tokensUsed: totalTokens },
    };
  }

  // Ensure metadata is present
  if (!resultObj.metadata) {
    resultObj.metadata = { totalDuration: duration, checkpointCount, tokensUsed: totalTokens };
  }
  if (!resultObj.type) {
    resultObj.type = jobType;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (contract as any).complete_job({
    args: {
      job_id: job.id,
      result: JSON.stringify(resultObj),
      attestation: null,
    },
    gas: '50000000000000',
  });

  log(`  Completed in ${duration}ms`);
}

// ---------------------------------------------------------------------------
// Main Loop
// ---------------------------------------------------------------------------

let shuttingDown = false;

function log(msg: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

async function main() {
  // Validate config
  if (!WORKER_ACCOUNT_ID || !WORKER_PRIVATE_KEY) {
    console.error('Missing required environment variables:');
    console.error('  ASYNC_AI_WORKER_ACCOUNT_ID - NEAR account ID for the worker');
    console.error('  ASYNC_AI_WORKER_PRIVATE_KEY - Private key (ed25519:...)');
    process.exit(1);
  }

  log('Async AI Worker Daemon starting...');
  log(`  Worker:   ${WORKER_ACCOUNT_ID}`);
  log(`  Contract: ${CONTRACT_ID}`);
  log(`  Network:  ${NETWORK_ID}`);
  log(`  AI Model: ${AI_MODEL}`);

  const { contract } = await connectNear();
  log('Connected to NEAR');

  if (DRY_RUN) {
    log('Dry run mode — verifying connection and exiting');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = await (contract as any).get_pending_count({});
    log(`Pending jobs: ${count}`);
    log('Dry run complete');
    process.exit(0);
  }

  // Graceful shutdown
  process.on('SIGINT', () => {
    log('SIGINT received — finishing current job and shutting down...');
    shuttingDown = true;
  });
  process.on('SIGTERM', () => {
    log('SIGTERM received — finishing current job and shutting down...');
    shuttingDown = true;
  });

  let consecutiveErrors = 0;
  let pollCycle = 0;

  while (!shuttingDown) {
    try {
      pollCycle++;

      // Periodically run timeout check
      if (pollCycle % TIMEOUT_CHECK_INTERVAL === 0) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const timedOut = await (contract as any).timeout_stale_jobs({
            args: {},
            gas: '30000000000000',
          });
          if (timedOut > 0) {
            log(`Timed out ${timedOut} stale jobs`);
          }
        } catch (err) {
          // Non-fatal — log and continue
          log(`Warning: timeout_stale_jobs failed: ${err instanceof Error ? err.message : err}`);
        }
      }

      // Check for pending jobs
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pendingCount = await (contract as any).get_pending_count({});

      if (pendingCount > 0) {
        log(`Found ${pendingCount} pending job(s) — claiming...`);

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const job: ContractJob = await (contract as any).claim_job({
            args: {},
            gas: '50000000000000',
          });

          log(`Claimed job ${job.id} (${job.job_type}) from ${job.owner}`);

          try {
            await processJob(contract, job);
            log(`Job ${job.id} completed successfully`);
          } catch (processErr) {
            const errMsg = processErr instanceof Error
              ? processErr.message
              : String(processErr);
            log(`Job ${job.id} failed: ${errMsg}`);

            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (contract as any).fail_job({
                args: {
                  job_id: job.id,
                  error: errMsg.substring(0, 500),
                },
                gas: '30000000000000',
              });
            } catch (failErr) {
              log(`Warning: fail_job call failed: ${failErr instanceof Error ? failErr.message : failErr}`);
            }
          }

          consecutiveErrors = 0;
        } catch (claimErr) {
          const msg = claimErr instanceof Error ? claimErr.message : String(claimErr);
          if (msg.includes('No pending jobs')) {
            // Race condition — another worker grabbed it
            log('No pending jobs (claimed by another worker)');
          } else {
            throw claimErr;
          }
        }
      }

      consecutiveErrors = 0;
    } catch (err) {
      consecutiveErrors++;
      const msg = err instanceof Error ? err.message : String(err);
      log(`Error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${msg}`);

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        log('Too many consecutive errors — shutting down');
        process.exit(1);
      }
    }

    // Wait before next poll
    if (!shuttingDown) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  log('Worker daemon stopped');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
