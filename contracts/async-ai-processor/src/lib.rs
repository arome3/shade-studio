mod errors;
mod events;
mod storage;
mod types;

use near_sdk::store::{LookupMap, LookupSet, IterableSet};
use near_sdk::{env, near, AccountId, FunctionError, NearToken, PanicOnDefault, Promise};

use errors::ContractError;
use storage::StorageKey;

pub use types::{
    Checkpoint, Config, Job, JobStatus, JobType, PaginatedJobs, Stats,
};

/// Async AI Pipeline Processor contract for NEAR.
///
/// Manages long-running AI analysis jobs with a yield/resume pattern:
/// - Users submit jobs with a deposit
/// - Authorized workers claim and process jobs
/// - Workers save checkpoints for intermediate progress
/// - Results are stored on-chain with optional TEE attestations
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct AsyncAIProcessor {
    /// Contract owner with admin privileges
    owner: AccountId,
    /// Whether the contract is paused
    is_paused: bool,
    /// All jobs by ID
    jobs: LookupMap<String, Job>,
    /// Job IDs grouped by owner account
    jobs_by_owner: LookupMap<AccountId, IterableSet<String>>,
    /// Queue of pending job IDs available for workers
    pending_jobs: IterableSet<String>,
    /// Set of authorized worker accounts
    workers: LookupSet<AccountId>,
    /// Monotonic nonce for generating unique job IDs
    job_nonce: u64,
    /// Total jobs ever submitted
    total_jobs: u64,
    /// Total completed jobs
    completed_jobs: u64,
    /// Total failed jobs
    failed_jobs: u64,
    /// Number of registered workers
    worker_count: u32,
    /// Contract configuration
    config: Config,
}

#[near]
impl AsyncAIProcessor {
    // =========================================================================
    // Initialization
    // =========================================================================

    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            owner,
            is_paused: false,
            jobs: LookupMap::new(borsh::to_vec(&StorageKey::Jobs).unwrap()),
            jobs_by_owner: LookupMap::new(borsh::to_vec(&StorageKey::JobsByOwner).unwrap()),
            pending_jobs: IterableSet::new(borsh::to_vec(&StorageKey::PendingJobs).unwrap()),
            workers: LookupSet::new(borsh::to_vec(&StorageKey::Workers).unwrap()),
            job_nonce: 0,
            total_jobs: 0,
            completed_jobs: 0,
            failed_jobs: 0,
            worker_count: 0,
            config: Config::default(),
        }
    }

    // =========================================================================
    // User methods
    // =========================================================================

    /// Submit a new AI processing job.
    /// Requires a deposit of at least `config.min_deposit`.
    #[payable]
    pub fn submit_job(&mut self, job_type: JobType, params: String) -> String {
        self.assert_not_paused();

        let caller = env::predecessor_account_id();
        let deposit = env::attached_deposit().as_yoctonear();

        if deposit < self.config.min_deposit {
            ContractError::InsufficientDeposit {
                required: self.config.min_deposit,
                attached: deposit,
            }
            .panic();
        }

        // Check active job limit
        let active = storage::count_active_jobs(&self.jobs, &self.jobs_by_owner, &caller);
        if active >= self.config.max_active_jobs_per_user {
            ContractError::ActiveJobLimitExceeded {
                limit: self.config.max_active_jobs_per_user,
            }
            .panic();
        }

        self.job_nonce += 1;
        let job_id = storage::generate_job_id(&caller, self.job_nonce);
        let now = env::block_timestamp();

        let job = Job {
            id: job_id.clone(),
            job_type: job_type.clone(),
            owner: caller.clone(),
            deposit,
            params,
            status: JobStatus::Pending,
            progress: 0,
            checkpoint: None,
            result: None,
            error: None,
            attestation: None,
            created_at: now,
            updated_at: now,
            completed_at: None,
            worker: None,
        };

        storage::store_job(&mut self.jobs, &mut self.jobs_by_owner, job);
        self.pending_jobs.insert(job_id.clone());
        self.total_jobs += 1;

        events::emit_job_submitted(&job_id, &caller, &job_type.as_key());

        job_id
    }

    /// Cancel a pending job. Only the job owner can cancel.
    /// The job must be in Pending status (not yet claimed by a worker).
    /// Refunds the deposit to the owner.
    pub fn cancel_job(&mut self, job_id: String) {
        self.assert_not_paused();

        let caller = env::predecessor_account_id();
        let job = self.jobs.get(&job_id).unwrap_or_else(|| {
            ContractError::JobNotFound(job_id.clone()).panic()
        });

        if job.owner != caller {
            ContractError::Unauthorized.panic();
        }

        if job.status != JobStatus::Pending {
            ContractError::InvalidStatusTransition {
                job_id: job_id.clone(),
                from: job.status.as_str().to_string(),
                to: "cancelled".to_string(),
            }
            .panic();
        }

        // Capture deposit before removing
        let refund_amount = job.deposit;

        storage::remove_job(
            &mut self.jobs,
            &mut self.jobs_by_owner,
            &mut self.pending_jobs,
            &job_id,
            &caller,
        );

        // Refund the deposit — Promise is scheduled as a NEAR receipt
        if refund_amount > 0 {
            let _ = Promise::new(caller.clone()).transfer(NearToken::from_yoctonear(refund_amount));
        }

        events::emit_job_cancelled(&job_id, &caller);
    }

    // =========================================================================
    // Worker methods
    // =========================================================================

    /// Claim the next pending job from the queue.
    /// Only callable by registered workers.
    /// Skips (and times out) any jobs that have exceeded the timeout.
    pub fn claim_job(&mut self) -> Job {
        self.assert_not_paused();
        self.assert_worker();

        let worker = env::predecessor_account_id();
        let now = env::block_timestamp();
        let timeout = self.config.job_timeout_ns;

        // Collect pending IDs to iterate safely
        let job_ids: Vec<String> = self.pending_jobs.iter().cloned().collect();

        for job_id in &job_ids {
            let job = match self.jobs.get(job_id) {
                Some(j) => j,
                None => {
                    // Stale entry — remove from pending
                    self.pending_jobs.remove(job_id);
                    continue;
                }
            };

            // Lazy timeout check: skip stale jobs
            if now.saturating_sub(job.created_at) > timeout {
                self.pending_jobs.remove(job_id);
                if let Some(j) = self.jobs.get_mut(job_id) {
                    j.status = JobStatus::Timeout;
                    j.error = Some("Job timed out".to_string());
                    j.updated_at = now;
                }
                continue;
            }

            // Found a valid job — claim it
            self.pending_jobs.remove(job_id);
            let job = self.jobs.get_mut(job_id).unwrap();
            job.status = JobStatus::Processing;
            job.worker = Some(worker.clone());
            job.updated_at = now;

            let result = job.clone();
            events::emit_job_claimed(job_id, &worker);
            return result;
        }

        // No valid pending jobs found
        ContractError::NoPendingJobs.panic()
    }

    /// Save a checkpoint for a job being processed.
    /// Transitions the job to Paused status.
    pub fn checkpoint_progress(
        &mut self,
        job_id: String,
        progress: u8,
        step: String,
        state: String,
    ) {
        self.assert_not_paused();
        self.assert_worker();

        let job = self.jobs.get_mut(&job_id).unwrap_or_else(|| {
            ContractError::JobNotFound(job_id.clone()).panic()
        });

        if job.status != JobStatus::Processing {
            ContractError::InvalidStatusTransition {
                job_id: job_id.clone(),
                from: job.status.as_str().to_string(),
                to: "paused".to_string(),
            }
            .panic();
        }

        let now = env::block_timestamp();
        let clamped_progress = progress.min(99); // Reserve 100 for completion
        job.progress = clamped_progress;
        job.status = JobStatus::Paused;
        job.checkpoint = Some(Checkpoint {
            progress: clamped_progress,
            step: step.clone(),
            state,
            timestamp: now,
        });
        job.updated_at = now;

        events::emit_job_checkpointed(&job_id, clamped_progress, &step);
    }

    /// Resume a paused job. Returns the job with its checkpoint for the worker
    /// to continue processing.
    pub fn resume_job(&mut self, job_id: String) -> Job {
        self.assert_not_paused();
        self.assert_worker();

        let worker = env::predecessor_account_id();
        let job = self.jobs.get_mut(&job_id).unwrap_or_else(|| {
            ContractError::JobNotFound(job_id.clone()).panic()
        });

        if job.status != JobStatus::Paused {
            ContractError::InvalidStatusTransition {
                job_id: job_id.clone(),
                from: job.status.as_str().to_string(),
                to: "processing".to_string(),
            }
            .panic();
        }

        job.status = JobStatus::Processing;
        job.worker = Some(worker.clone());
        job.updated_at = env::block_timestamp();

        let result = job.clone();
        events::emit_job_resumed(&job_id, &worker);
        result
    }

    /// Complete a job with results.
    pub fn complete_job(
        &mut self,
        job_id: String,
        result: String,
        attestation: Option<String>,
    ) {
        self.assert_not_paused();
        self.assert_worker();

        let worker = env::predecessor_account_id();
        let job = self.jobs.get_mut(&job_id).unwrap_or_else(|| {
            ContractError::JobNotFound(job_id.clone()).panic()
        });

        if job.status != JobStatus::Processing && job.status != JobStatus::Paused {
            ContractError::InvalidStatusTransition {
                job_id: job_id.clone(),
                from: job.status.as_str().to_string(),
                to: "completed".to_string(),
            }
            .panic();
        }

        let now = env::block_timestamp();
        let has_attestation = attestation.is_some();
        job.status = JobStatus::Completed;
        job.progress = 100;
        job.result = Some(result);
        job.attestation = attestation;
        job.updated_at = now;
        job.completed_at = Some(now);

        self.completed_jobs += 1;

        events::emit_job_completed(&job_id, &worker, has_attestation);
    }

    /// Fail a job with an error message.
    pub fn fail_job(&mut self, job_id: String, error: String) {
        self.assert_not_paused();
        self.assert_worker();

        let job = self.jobs.get_mut(&job_id).unwrap_or_else(|| {
            ContractError::JobNotFound(job_id.clone()).panic()
        });

        if job.status.is_terminal() {
            ContractError::InvalidStatusTransition {
                job_id: job_id.clone(),
                from: job.status.as_str().to_string(),
                to: "failed".to_string(),
            }
            .panic();
        }

        job.status = JobStatus::Failed;
        job.error = Some(error.clone());
        job.updated_at = env::block_timestamp();

        // Remove from pending queue if it was there
        self.pending_jobs.remove(&job_id);
        self.failed_jobs += 1;

        events::emit_job_failed(&job_id, &error);
    }

    // =========================================================================
    // Maintenance methods
    // =========================================================================

    /// Check for and timeout stale jobs. Callable by owner or workers.
    /// Returns the number of jobs timed out.
    pub fn timeout_stale_jobs(&mut self) -> u32 {
        let caller = env::predecessor_account_id();
        if caller != self.owner && !self.workers.contains(&caller) {
            ContractError::Unauthorized.panic();
        }

        let now = env::block_timestamp();
        let timeout = self.config.job_timeout_ns;
        let mut timed_out: Vec<String> = Vec::new();

        // Check pending jobs
        for job_id in self.pending_jobs.iter() {
            if let Some(job) = self.jobs.get(job_id) {
                if now.saturating_sub(job.created_at) > timeout {
                    timed_out.push(job_id.clone());
                }
            }
        }

        // Apply timeouts
        let count = timed_out.len() as u32;
        for job_id in &timed_out {
            self.pending_jobs.remove(job_id);
            if let Some(job) = self.jobs.get_mut(job_id) {
                job.status = JobStatus::Timeout;
                job.error = Some("Job timed out".to_string());
                job.updated_at = now;
            }
        }
        count
    }

    // =========================================================================
    // View methods
    // =========================================================================

    /// Get a job by ID.
    pub fn get_job(&self, job_id: String) -> Option<Job> {
        self.jobs.get(&job_id).cloned()
    }

    /// Get jobs for an owner with pagination.
    pub fn get_jobs_by_owner(
        &self,
        owner: AccountId,
        include_completed: Option<bool>,
        offset: Option<u32>,
        limit: Option<u32>,
    ) -> PaginatedJobs {
        let (jobs, total) = storage::get_jobs_by_owner(
            &self.jobs,
            &self.jobs_by_owner,
            &owner,
            include_completed.unwrap_or(false),
            offset.unwrap_or(0),
            limit.unwrap_or(50),
        );
        let has_more = (offset.unwrap_or(0) + jobs.len() as u32) < total;
        PaginatedJobs {
            jobs,
            total,
            has_more,
        }
    }

    /// Get the number of pending jobs in the queue.
    pub fn get_pending_count(&self) -> u32 {
        self.pending_jobs.len()
    }

    /// Get contract statistics.
    pub fn get_stats(&self) -> Stats {
        Stats {
            total_jobs: self.total_jobs,
            pending_jobs: self.pending_jobs.len() as u64,
            completed_jobs: self.completed_jobs,
            failed_jobs: self.failed_jobs,
            registered_workers: self.worker_count,
            is_paused: self.is_paused,
        }
    }

    /// Get the contract configuration.
    pub fn get_config(&self) -> Config {
        self.config.clone()
    }

    // =========================================================================
    // Admin methods
    // =========================================================================

    /// Register a new worker account.
    pub fn register_worker(&mut self, worker: AccountId) {
        self.assert_owner();
        if !self.workers.contains(&worker) {
            self.workers.insert(worker.clone());
            self.worker_count += 1;
            events::emit_worker_registered(&worker);
        }
    }

    /// Remove a worker account.
    pub fn remove_worker(&mut self, worker: AccountId) {
        self.assert_owner();
        if self.workers.remove(&worker) {
            self.worker_count = self.worker_count.saturating_sub(1);
            events::emit_worker_removed(&worker);
        }
    }

    /// Update contract configuration.
    pub fn update_config(&mut self, config: Config) {
        self.assert_owner();
        self.config = config;
    }

    /// Pause or unpause the contract.
    pub fn set_paused(&mut self, paused: bool) {
        self.assert_owner();
        self.is_paused = paused;
        events::emit_contract_paused(paused);
    }

    // =========================================================================
    // Internal helpers
    // =========================================================================

    fn assert_owner(&self) {
        if env::predecessor_account_id() != self.owner {
            ContractError::Unauthorized.panic();
        }
    }

    fn assert_worker(&self) {
        let caller = env::predecessor_account_id();
        if !self.workers.contains(&caller) {
            ContractError::NotAWorker.panic();
        }
    }

    fn assert_not_paused(&self) {
        if self.is_paused {
            ContractError::ContractPaused.panic();
        }
    }
}

use near_sdk::borsh;

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;
    use near_sdk::NearToken;

    fn owner() -> AccountId {
        "owner.testnet".parse().unwrap()
    }

    fn alice() -> AccountId {
        "alice.testnet".parse().unwrap()
    }

    fn worker1() -> AccountId {
        "worker1.testnet".parse().unwrap()
    }

    fn setup_context(predecessor: &AccountId) {
        let context = VMContextBuilder::new()
            .predecessor_account_id(predecessor.clone())
            .block_timestamp(1_700_000_000 * 1_000_000_000)
            .build();
        testing_env!(context);
    }

    fn setup_context_with_deposit(predecessor: &AccountId, deposit: u128) {
        let context = VMContextBuilder::new()
            .predecessor_account_id(predecessor.clone())
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(1_700_000_000 * 1_000_000_000)
            .build();
        testing_env!(context);
    }

    fn init_contract() -> AsyncAIProcessor {
        setup_context(&owner());
        let mut contract = AsyncAIProcessor::new(owner());
        contract.register_worker(worker1());
        contract
    }

    #[test]
    fn test_init() {
        setup_context(&owner());
        let contract = AsyncAIProcessor::new(owner());
        assert_eq!(contract.owner, owner());
        assert!(!contract.is_paused);

        let stats = contract.get_stats();
        assert_eq!(stats.total_jobs, 0);
        assert_eq!(stats.pending_jobs, 0);
        assert_eq!(stats.completed_jobs, 0);
        assert_eq!(stats.failed_jobs, 0);
    }

    #[test]
    fn test_submit_job() {
        let mut contract = init_contract();

        setup_context_with_deposit(&alice(), Config::DEFAULT_MIN_DEPOSIT);
        let job_id = contract.submit_job(
            JobType::DocumentAnalysis,
            r#"{"documentIds":["doc-1"],"depth":"standard"}"#.into(),
        );

        assert!(job_id.starts_with("job-"));
        assert_eq!(contract.get_pending_count(), 1);

        let job = contract.get_job(job_id).unwrap();
        assert_eq!(job.status, JobStatus::Pending);
        assert_eq!(job.owner, alice());
        assert_eq!(job.progress, 0);
    }

    #[test]
    fn test_full_lifecycle() {
        let mut contract = init_contract();

        // Submit
        setup_context_with_deposit(&alice(), Config::DEFAULT_MIN_DEPOSIT);
        let job_id = contract.submit_job(
            JobType::ProposalReview,
            r#"{"proposalId":"prop-1","grantProgram":"near-grants"}"#.into(),
        );
        assert_eq!(contract.get_stats().total_jobs, 1);

        // Claim
        setup_context(&worker1());
        let claimed = contract.claim_job();
        assert_eq!(claimed.id, job_id);
        assert_eq!(claimed.status, JobStatus::Processing);
        assert_eq!(contract.get_pending_count(), 0);

        // Checkpoint
        contract.checkpoint_progress(
            job_id.clone(),
            50,
            "Analyzing section 2/4".into(),
            r#"{"section":2}"#.into(),
        );
        let paused = contract.get_job(job_id.clone()).unwrap();
        assert_eq!(paused.status, JobStatus::Paused);
        assert_eq!(paused.progress, 50);
        assert!(paused.checkpoint.is_some());

        // Resume
        let resumed = contract.resume_job(job_id.clone());
        assert_eq!(resumed.status, JobStatus::Processing);
        assert!(resumed.checkpoint.is_some()); // Checkpoint preserved

        // Complete
        contract.complete_job(
            job_id.clone(),
            r#"{"score":85,"recommendations":["improve budget section"]}"#.into(),
            Some(r#"{"tee_type":"intel-tdx"}"#.into()),
        );
        let completed = contract.get_job(job_id).unwrap();
        assert_eq!(completed.status, JobStatus::Completed);
        assert_eq!(completed.progress, 100);
        assert!(completed.result.is_some());
        assert!(completed.attestation.is_some());
        assert!(completed.completed_at.is_some());
        assert_eq!(contract.get_stats().completed_jobs, 1);
    }

    #[test]
    fn test_fail_job() {
        let mut contract = init_contract();

        setup_context_with_deposit(&alice(), Config::DEFAULT_MIN_DEPOSIT);
        let job_id = contract.submit_job(
            JobType::GrantMatching,
            r#"{"projectDescription":"test project"}"#.into(),
        );

        setup_context(&worker1());
        contract.claim_job();
        contract.fail_job(job_id.clone(), "Model inference error".into());

        let failed = contract.get_job(job_id).unwrap();
        assert_eq!(failed.status, JobStatus::Failed);
        assert_eq!(failed.error.as_deref(), Some("Model inference error"));
        assert_eq!(contract.get_stats().failed_jobs, 1);
    }

    #[test]
    fn test_cancel_job() {
        let mut contract = init_contract();

        setup_context_with_deposit(&alice(), Config::DEFAULT_MIN_DEPOSIT);
        let job_id = contract.submit_job(
            JobType::WeeklySynthesis,
            r#"{"accountId":"alice.testnet"}"#.into(),
        );
        assert_eq!(contract.get_pending_count(), 1);

        setup_context(&alice());
        contract.cancel_job(job_id.clone());

        assert!(contract.get_job(job_id).is_none());
        assert_eq!(contract.get_pending_count(), 0);
    }

    #[test]
    #[should_panic(expected = "Unauthorized")]
    fn test_cancel_by_non_owner() {
        let mut contract = init_contract();

        setup_context_with_deposit(&alice(), Config::DEFAULT_MIN_DEPOSIT);
        let job_id = contract.submit_job(
            JobType::DocumentAnalysis,
            r#"{"documentIds":["doc-1"],"depth":"quick"}"#.into(),
        );

        // worker tries to cancel alice's job
        setup_context(&worker1());
        contract.cancel_job(job_id);
    }

    #[test]
    #[should_panic(expected = "not a registered worker")]
    fn test_claim_by_non_worker() {
        let mut contract = init_contract();

        setup_context_with_deposit(&alice(), Config::DEFAULT_MIN_DEPOSIT);
        contract.submit_job(
            JobType::DocumentAnalysis,
            r#"{"documentIds":["doc-1"],"depth":"quick"}"#.into(),
        );

        setup_context(&alice());
        contract.claim_job();
    }

    #[test]
    #[should_panic(expected = "Insufficient deposit")]
    fn test_insufficient_deposit() {
        let mut contract = init_contract();

        setup_context_with_deposit(&alice(), 1); // 1 yoctoNEAR — too low
        contract.submit_job(
            JobType::DocumentAnalysis,
            r#"{"documentIds":["doc-1"],"depth":"quick"}"#.into(),
        );
    }

    #[test]
    #[should_panic(expected = "Invalid status transition")]
    fn test_cannot_complete_pending_job() {
        let mut contract = init_contract();

        setup_context_with_deposit(&alice(), Config::DEFAULT_MIN_DEPOSIT);
        let job_id = contract.submit_job(
            JobType::DocumentAnalysis,
            r#"{"documentIds":["doc-1"],"depth":"quick"}"#.into(),
        );

        // Worker tries to complete without claiming
        setup_context(&worker1());
        contract.complete_job(job_id, "{}".into(), None);
    }

    #[test]
    #[should_panic(expected = "Invalid status transition")]
    fn test_cannot_checkpoint_completed_job() {
        let mut contract = init_contract();

        setup_context_with_deposit(&alice(), Config::DEFAULT_MIN_DEPOSIT);
        let job_id = contract.submit_job(
            JobType::DocumentAnalysis,
            r#"{"documentIds":["doc-1"],"depth":"quick"}"#.into(),
        );

        setup_context(&worker1());
        contract.claim_job();
        contract.complete_job(job_id.clone(), "{}".into(), None);

        // Try to checkpoint a completed job
        contract.checkpoint_progress(job_id, 50, "step".into(), "{}".into());
    }

    #[test]
    fn test_pause_blocks_submit() {
        let mut contract = init_contract();

        setup_context(&owner());
        contract.set_paused(true);
        assert!(contract.get_stats().is_paused);

        // Should panic
        setup_context_with_deposit(&alice(), Config::DEFAULT_MIN_DEPOSIT);
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            contract.submit_job(
                JobType::DocumentAnalysis,
                r#"{"documentIds":["doc-1"],"depth":"quick"}"#.into(),
            );
        }));
        assert!(result.is_err());
    }

    #[test]
    fn test_register_and_remove_worker() {
        setup_context(&owner());
        let mut contract = AsyncAIProcessor::new(owner());

        let stats = contract.get_stats();
        assert_eq!(stats.registered_workers, 0);

        contract.register_worker(worker1());
        assert_eq!(contract.get_stats().registered_workers, 1);

        // Re-register should not double-count
        contract.register_worker(worker1());
        assert_eq!(contract.get_stats().registered_workers, 1);

        contract.remove_worker(worker1());
        assert_eq!(contract.get_stats().registered_workers, 0);
    }

    #[test]
    fn test_get_jobs_by_owner() {
        let mut contract = init_contract();

        // Submit 2 jobs
        setup_context_with_deposit(&alice(), Config::DEFAULT_MIN_DEPOSIT);
        contract.submit_job(
            JobType::DocumentAnalysis,
            r#"{"documentIds":["doc-1"],"depth":"quick"}"#.into(),
        );
        setup_context_with_deposit(&alice(), Config::DEFAULT_MIN_DEPOSIT);
        contract.submit_job(
            JobType::ProposalReview,
            r#"{"proposalId":"p-1","grantProgram":"test"}"#.into(),
        );

        let result = contract.get_jobs_by_owner(alice(), Some(true), None, None);
        assert_eq!(result.total, 2);
        assert_eq!(result.jobs.len(), 2);
        assert!(!result.has_more);
    }

    #[test]
    fn test_active_job_limit() {
        let mut contract = init_contract();

        // Update config to allow only 2 active jobs
        setup_context(&owner());
        contract.update_config(Config {
            max_active_jobs_per_user: 2,
            ..Config::default()
        });

        // Submit 2 jobs (should work)
        setup_context_with_deposit(&alice(), Config::DEFAULT_MIN_DEPOSIT);
        contract.submit_job(
            JobType::DocumentAnalysis,
            r#"{"documentIds":["doc-1"],"depth":"quick"}"#.into(),
        );
        setup_context_with_deposit(&alice(), Config::DEFAULT_MIN_DEPOSIT);
        contract.submit_job(
            JobType::ProposalReview,
            r#"{"proposalId":"p-1","grantProgram":"test"}"#.into(),
        );

        // Third job should fail
        setup_context_with_deposit(&alice(), Config::DEFAULT_MIN_DEPOSIT);
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            contract.submit_job(
                JobType::GrantMatching,
                r#"{"projectDescription":"test"}"#.into(),
            );
        }));
        assert!(result.is_err());
    }

    fn setup_context_with_deposit_and_timestamp(
        predecessor: &AccountId,
        deposit: u128,
        timestamp_ns: u64,
    ) {
        let context = VMContextBuilder::new()
            .predecessor_account_id(predecessor.clone())
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(timestamp_ns)
            .build();
        testing_env!(context);
    }

    fn setup_context_with_timestamp(predecessor: &AccountId, timestamp_ns: u64) {
        let context = VMContextBuilder::new()
            .predecessor_account_id(predecessor.clone())
            .block_timestamp(timestamp_ns)
            .build();
        testing_env!(context);
    }

    #[test]
    fn test_cancel_refunds_deposit() {
        let mut contract = init_contract();

        setup_context_with_deposit(&alice(), Config::DEFAULT_MIN_DEPOSIT);
        let job_id = contract.submit_job(
            JobType::WeeklySynthesis,
            r#"{"accountId":"alice.testnet"}"#.into(),
        );

        // Verify deposit was stored
        let job = contract.get_job(job_id.clone()).unwrap();
        assert_eq!(job.deposit, Config::DEFAULT_MIN_DEPOSIT);

        // Cancel — should not panic (Promise transfer is created internally)
        setup_context(&alice());
        contract.cancel_job(job_id.clone());

        assert!(contract.get_job(job_id).is_none());
        assert_eq!(contract.get_pending_count(), 0);
    }

    #[test]
    fn test_timeout_stale_jobs() {
        let mut contract = init_contract();
        let base_ts = 1_700_000_000 * 1_000_000_000u64;

        // Submit a job at base timestamp
        setup_context_with_deposit_and_timestamp(
            &alice(),
            Config::DEFAULT_MIN_DEPOSIT,
            base_ts,
        );
        let job_id = contract.submit_job(
            JobType::DocumentAnalysis,
            r#"{"documentIds":["doc-1"],"depth":"quick"}"#.into(),
        );
        assert_eq!(contract.get_pending_count(), 1);

        // Advance time past timeout (10 min + 1 sec)
        let past_timeout = base_ts + Config::DEFAULT_JOB_TIMEOUT_NS + 1_000_000_000;
        setup_context_with_timestamp(&worker1(), past_timeout);

        let count = contract.timeout_stale_jobs();
        assert_eq!(count, 1);
        assert_eq!(contract.get_pending_count(), 0);

        let job = contract.get_job(job_id).unwrap();
        assert_eq!(job.status, JobStatus::Timeout);
        assert_eq!(job.error.as_deref(), Some("Job timed out"));
    }

    #[test]
    fn test_claim_skips_timed_out_jobs() {
        let mut contract = init_contract();
        let base_ts = 1_700_000_000 * 1_000_000_000u64;

        // Submit job 1 (will be stale)
        setup_context_with_deposit_and_timestamp(
            &alice(),
            Config::DEFAULT_MIN_DEPOSIT,
            base_ts,
        );
        let stale_id = contract.submit_job(
            JobType::DocumentAnalysis,
            r#"{"documentIds":["doc-1"],"depth":"quick"}"#.into(),
        );

        // Submit job 2 (recent) at a time just before timeout
        let recent_ts = base_ts + Config::DEFAULT_JOB_TIMEOUT_NS - 1_000_000_000;
        setup_context_with_deposit_and_timestamp(
            &alice(),
            Config::DEFAULT_MIN_DEPOSIT,
            recent_ts,
        );
        let fresh_id = contract.submit_job(
            JobType::ProposalReview,
            r#"{"proposalId":"p-1","grantProgram":"test"}"#.into(),
        );

        // Worker claims at a time past the first job's timeout
        let claim_ts = base_ts + Config::DEFAULT_JOB_TIMEOUT_NS + 1_000_000_000;
        setup_context_with_timestamp(&worker1(), claim_ts);

        let claimed = contract.claim_job();
        assert_eq!(claimed.id, fresh_id);
        assert_eq!(claimed.status, JobStatus::Processing);

        // Stale job should be timed out
        let stale = contract.get_job(stale_id).unwrap();
        assert_eq!(stale.status, JobStatus::Timeout);
    }

    #[test]
    fn test_progress_clamped_at_99() {
        let mut contract = init_contract();

        setup_context_with_deposit(&alice(), Config::DEFAULT_MIN_DEPOSIT);
        let job_id = contract.submit_job(
            JobType::DocumentAnalysis,
            r#"{"documentIds":["doc-1"],"depth":"quick"}"#.into(),
        );

        setup_context(&worker1());
        contract.claim_job();
        contract.checkpoint_progress(job_id.clone(), 100, "almost done".into(), "{}".into());

        let job = contract.get_job(job_id).unwrap();
        assert_eq!(job.progress, 99); // Clamped, 100 reserved for complete_job
    }
}
