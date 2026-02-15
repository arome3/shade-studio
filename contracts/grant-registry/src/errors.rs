use near_sdk::FunctionError;
use std::fmt;

/// Contract error types for the Grant Registry.
#[derive(Debug)]
#[allow(dead_code)]
pub enum ContractError {
    /// Contract is paused
    ContractPaused,
    /// Caller is not the contract owner
    Unauthorized,
    /// Program not found by ID
    ProgramNotFound(String),
    /// Program already exists with this ID
    ProgramAlreadyExists(String),
    /// Project not found by ID
    ProjectNotFound(String),
    /// Project already exists with this ID
    ProjectAlreadyExists(String),
    /// Application not found by ID
    ApplicationNotFound(String),
    /// Application already exists with this ID
    ApplicationAlreadyExists(String),
    /// Invalid input parameters
    InvalidParams(String),
}

impl fmt::Display for ContractError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ContractPaused => write!(f, "Contract is paused"),
            Self::Unauthorized => write!(f, "Unauthorized: caller is not authorized"),
            Self::ProgramNotFound(id) => write!(f, "Program not found: {id}"),
            Self::ProgramAlreadyExists(id) => write!(f, "Program already exists: {id}"),
            Self::ProjectNotFound(id) => write!(f, "Project not found: {id}"),
            Self::ProjectAlreadyExists(id) => write!(f, "Project already exists: {id}"),
            Self::ApplicationNotFound(id) => write!(f, "Application not found: {id}"),
            Self::ApplicationAlreadyExists(id) => {
                write!(f, "Application already exists: {id}")
            }
            Self::InvalidParams(msg) => write!(f, "Invalid parameters: {msg}"),
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
        let err = ContractError::ProgramNotFound("pgm-1".into());
        assert!(err.to_string().contains("pgm-1"));

        let err = ContractError::ProjectAlreadyExists("proj-1".into());
        assert!(err.to_string().contains("proj-1"));
    }
}
