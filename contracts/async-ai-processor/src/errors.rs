use near_sdk::FunctionError;
use std::fmt;

/// Contract error types for the async AI processor.
#[derive(Debug)]
#[allow(dead_code)]
pub enum ContractError {
    /// Contract is paused — no operations allowed
    ContractPaused,
    /// Caller is not the contract owner
    Unauthorized,
    /// Caller is not a registered worker
    NotAWorker,
    /// Job not found by ID
    JobNotFound(String),
    /// Invalid status transition
    InvalidStatusTransition { job_id: String, from: String, to: String },
    /// No pending jobs available for claiming
    NoPendingJobs,
    /// Attached deposit is less than required
    InsufficientDeposit { required: u128, attached: u128 },
    /// User has too many active jobs
    ActiveJobLimitExceeded { limit: u32 },
    /// Invalid job parameters
    InvalidParams(String),
}

impl fmt::Display for ContractError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ContractPaused => write!(f, "Contract is paused"),
            Self::Unauthorized => write!(f, "Unauthorized: caller is not contract owner"),
            Self::NotAWorker => write!(f, "Unauthorized: caller is not a registered worker"),
            Self::JobNotFound(id) => write!(f, "Job not found: {id}"),
            Self::InvalidStatusTransition { job_id, from, to } => {
                write!(f, "Invalid status transition for job {job_id}: {from} -> {to}")
            }
            Self::NoPendingJobs => write!(f, "No pending jobs available"),
            Self::InsufficientDeposit { required, attached } => {
                write!(
                    f,
                    "Insufficient deposit: required {required} yoctoNEAR, attached {attached}"
                )
            }
            Self::ActiveJobLimitExceeded { limit } => {
                write!(f, "Active job limit exceeded: maximum {limit} concurrent jobs")
            }
            Self::InvalidParams(msg) => write!(f, "Invalid job parameters: {msg}"),
        }
    }
}

impl FunctionError for ContractError {
    fn panic(&self) -> ! {
        near_sdk::env::panic_str(&self.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_display() {
        let err = ContractError::JobNotFound("job-123".into());
        assert!(err.to_string().contains("job-123"));

        let err = ContractError::InsufficientDeposit {
            required: 100,
            attached: 50,
        };
        assert!(err.to_string().contains("100"));
        assert!(err.to_string().contains("50"));

        let err = ContractError::InvalidStatusTransition {
            job_id: "job-1".into(),
            from: "completed".into(),
            to: "processing".into(),
        };
        assert!(err.to_string().contains("completed"));
        assert!(err.to_string().contains("processing"));
    }
}
