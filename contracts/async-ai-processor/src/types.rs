use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::AccountId;

/// Supported AI job types.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde", rename_all = "kebab-case")]
pub enum JobType {
    DocumentAnalysis,
    ProposalReview,
    CompetitiveResearch,
    GrantMatching,
    WeeklySynthesis,
}

impl JobType {
    pub fn as_key(&self) -> String {
        match self {
            JobType::DocumentAnalysis => "document-analysis".to_string(),
            JobType::ProposalReview => "proposal-review".to_string(),
            JobType::CompetitiveResearch => "competitive-research".to_string(),
            JobType::GrantMatching => "grant-matching".to_string(),
            JobType::WeeklySynthesis => "weekly-synthesis".to_string(),
        }
    }
}

impl std::fmt::Display for JobType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_key())
    }
}

/// Job lifecycle status.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde", rename_all = "kebab-case")]
pub enum JobStatus {
    Pending,
    Processing,
    Paused,
    Completed,
    Failed,
    Timeout,
}

impl JobStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            JobStatus::Pending => "pending",
            JobStatus::Processing => "processing",
            JobStatus::Paused => "paused",
            JobStatus::Completed => "completed",
            JobStatus::Failed => "failed",
            JobStatus::Timeout => "timeout",
        }
    }

    /// Whether this is a terminal status (no further transitions allowed).
    pub fn is_terminal(&self) -> bool {
        matches!(self, JobStatus::Completed | JobStatus::Failed | JobStatus::Timeout)
    }
}

/// Intermediate checkpoint saved during job processing.
#[derive(Debug, Clone, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Checkpoint {
    /// Progress percentage (0–100)
    pub progress: u8,
    /// Current processing step description
    pub step: String,
    /// Serialized intermediate state (JSON string)
    pub state: String,
    /// Timestamp in nanoseconds
    pub timestamp: u64,
}

/// Full job record stored on-chain.
#[derive(Debug, Clone, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Job {
    pub id: String,
    pub job_type: JobType,
    pub owner: AccountId,
    /// Deposit attached when submitting this job (yoctoNEAR)
    pub deposit: u128,
    /// Serialized job parameters (JSON string)
    pub params: String,
    pub status: JobStatus,
    pub progress: u8,
    pub checkpoint: Option<Checkpoint>,
    /// Serialized result (JSON string, set on completion)
    pub result: Option<String>,
    /// Error message (set on failure)
    pub error: Option<String>,
    /// TEE attestation (JSON string)
    pub attestation: Option<String>,
    /// Created timestamp in nanoseconds
    pub created_at: u64,
    /// Last updated timestamp in nanoseconds
    pub updated_at: u64,
    /// Completed timestamp in nanoseconds
    pub completed_at: Option<u64>,
    /// Worker that claimed this job
    pub worker: Option<AccountId>,
}

/// Contract configuration.
#[derive(Debug, Clone, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Config {
    /// Minimum deposit required to submit a job (yoctoNEAR)
    pub min_deposit: u128,
    /// Maximum active (non-terminal) jobs per user
    pub max_active_jobs_per_user: u32,
    /// Job timeout in nanoseconds (default 10 minutes)
    pub job_timeout_ns: u64,
}

impl Config {
    /// 0.01 NEAR in yoctoNEAR
    pub const DEFAULT_MIN_DEPOSIT: u128 = 10_000_000_000_000_000_000_000;
    /// 5 concurrent jobs per user
    pub const DEFAULT_MAX_ACTIVE_JOBS: u32 = 5;
    /// 10 minutes in nanoseconds
    pub const DEFAULT_JOB_TIMEOUT_NS: u64 = 10 * 60 * 1_000_000_000;
}

impl Default for Config {
    fn default() -> Self {
        Self {
            min_deposit: Self::DEFAULT_MIN_DEPOSIT,
            max_active_jobs_per_user: Self::DEFAULT_MAX_ACTIVE_JOBS,
            job_timeout_ns: Self::DEFAULT_JOB_TIMEOUT_NS,
        }
    }
}

/// Contract statistics.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Stats {
    pub total_jobs: u64,
    pub pending_jobs: u64,
    pub completed_jobs: u64,
    pub failed_jobs: u64,
    pub registered_workers: u32,
    pub is_paused: bool,
}

/// Paginated jobs response.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct PaginatedJobs {
    pub jobs: Vec<Job>,
    pub total: u32,
    pub has_more: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn job_type_as_key() {
        assert_eq!(JobType::DocumentAnalysis.as_key(), "document-analysis");
        assert_eq!(JobType::ProposalReview.as_key(), "proposal-review");
        assert_eq!(JobType::CompetitiveResearch.as_key(), "competitive-research");
        assert_eq!(JobType::GrantMatching.as_key(), "grant-matching");
        assert_eq!(JobType::WeeklySynthesis.as_key(), "weekly-synthesis");
    }

    #[test]
    fn job_type_serde_roundtrip() {
        let jt = JobType::GrantMatching;
        let json = serde_json::to_string(&jt).unwrap();
        assert_eq!(json, "\"grant-matching\"");
        let parsed: JobType = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, jt);
    }

    #[test]
    fn job_status_terminal() {
        assert!(!JobStatus::Pending.is_terminal());
        assert!(!JobStatus::Processing.is_terminal());
        assert!(!JobStatus::Paused.is_terminal());
        assert!(JobStatus::Completed.is_terminal());
        assert!(JobStatus::Failed.is_terminal());
        assert!(JobStatus::Timeout.is_terminal());
    }

    #[test]
    fn default_config() {
        let config = Config::default();
        assert_eq!(config.min_deposit, Config::DEFAULT_MIN_DEPOSIT);
        assert_eq!(config.max_active_jobs_per_user, Config::DEFAULT_MAX_ACTIVE_JOBS);
        assert_eq!(config.job_timeout_ns, Config::DEFAULT_JOB_TIMEOUT_NS);
    }
}
