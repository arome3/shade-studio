use near_sdk::FunctionError;
use std::fmt;

/// Contract error types for the ZK verifier.
#[derive(Debug)]
#[allow(dead_code)]
pub enum ContractError {
    /// No verification key registered for the given circuit type
    VerificationKeyNotFound(String),
    /// Groth16 proof verification failed (pairing check)
    ProofVerificationFailed,
    /// Proof format is invalid (wrong number of elements, non-numeric strings)
    InvalidProofFormat(String),
    /// Public signals count doesn't match verification key IC length
    InvalidPublicSignals(String),
    /// Contract is paused — no operations allowed
    ContractPaused,
    /// Caller is not the contract owner
    Unauthorized,
    /// Credential not found by ID
    CredentialNotFound(String),
    /// Credential has expired
    CredentialExpired(String),
    /// Attached deposit is less than required storage cost
    InsufficientDeposit { required: u128, attached: u128 },
    /// Verification key format is invalid
    InvalidVerificationKey(String),
}

impl fmt::Display for ContractError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::VerificationKeyNotFound(ct) => {
                write!(f, "No verification key registered for circuit: {ct}")
            }
            Self::ProofVerificationFailed => {
                write!(f, "Groth16 proof verification failed")
            }
            Self::InvalidProofFormat(msg) => {
                write!(f, "Invalid proof format: {msg}")
            }
            Self::InvalidPublicSignals(msg) => {
                write!(f, "Invalid public signals: {msg}")
            }
            Self::ContractPaused => {
                write!(f, "Contract is paused")
            }
            Self::Unauthorized => {
                write!(f, "Unauthorized: caller is not contract owner")
            }
            Self::CredentialNotFound(id) => {
                write!(f, "Credential not found: {id}")
            }
            Self::CredentialExpired(id) => {
                write!(f, "Credential has expired: {id}")
            }
            Self::InsufficientDeposit { required, attached } => {
                write!(
                    f,
                    "Insufficient deposit: required {required} yoctoNEAR, attached {attached}"
                )
            }
            Self::InvalidVerificationKey(msg) => {
                write!(f, "Invalid verification key: {msg}")
            }
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
        let err = ContractError::VerificationKeyNotFound("verified-builder".into());
        assert!(err.to_string().contains("verified-builder"));

        let err = ContractError::InsufficientDeposit {
            required: 100,
            attached: 50,
        };
        assert!(err.to_string().contains("100"));
        assert!(err.to_string().contains("50"));
    }
}
