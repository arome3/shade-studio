use near_sdk::FunctionError;
use std::fmt;

/// Contract error types for the Shade Agent Registry.
#[derive(Debug)]
#[allow(dead_code)]
pub enum ContractError {
    /// Contract is paused
    ContractPaused,
    /// Caller is not the contract owner
    Unauthorized,
    /// Template not found by ID
    TemplateNotFound(String),
    /// Template already exists with this ID
    TemplateAlreadyExists(String),
    /// Agent instance not found
    InstanceNotFound(String),
    /// Agent instance already registered
    InstanceAlreadyRegistered(String),
    /// Codehash mismatch during verification
    CodehashMismatch { expected: String, actual: String },
    /// Invalid input parameters
    InvalidParams(String),
}

impl fmt::Display for ContractError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ContractPaused => write!(f, "Contract is paused"),
            Self::Unauthorized => write!(f, "Unauthorized: caller is not contract owner"),
            Self::TemplateNotFound(id) => write!(f, "Template not found: {id}"),
            Self::TemplateAlreadyExists(id) => write!(f, "Template already exists: {id}"),
            Self::InstanceNotFound(id) => write!(f, "Agent instance not found: {id}"),
            Self::InstanceAlreadyRegistered(id) => {
                write!(f, "Agent instance already registered: {id}")
            }
            Self::CodehashMismatch { expected, actual } => {
                write!(f, "Codehash mismatch: expected {expected}, got {actual}")
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
        let err = ContractError::TemplateNotFound("tmpl-1".into());
        assert!(err.to_string().contains("tmpl-1"));

        let err = ContractError::CodehashMismatch {
            expected: "abc".into(),
            actual: "def".into(),
        };
        assert!(err.to_string().contains("abc"));
        assert!(err.to_string().contains("def"));
    }
}
