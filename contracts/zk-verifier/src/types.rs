use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::AccountId;

/// Circuit types supported by the verifier contract.
/// Serde uses kebab-case to match snarkjs/TypeScript circuit identifiers.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde", rename_all = "kebab-case")]
pub enum CircuitType {
    VerifiedBuilder,
    GrantTrackRecord,
    TeamAttestation,
}

impl CircuitType {
    /// Returns a string key suitable for storage map lookups.
    pub fn as_key(&self) -> String {
        match self {
            CircuitType::VerifiedBuilder => "verified-builder".to_string(),
            CircuitType::GrantTrackRecord => "grant-track-record".to_string(),
            CircuitType::TeamAttestation => "team-attestation".to_string(),
        }
    }
}

impl std::fmt::Display for CircuitType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_key())
    }
}

/// Groth16 proof from snarkjs.
/// Uses Vec<String> for pi_a/pi_c (not fixed arrays) for robustness
/// against varying snarkjs output formats.
#[derive(Debug, Clone, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Groth16Proof {
    /// G1 point: [x, y, "1"]
    pub pi_a: Vec<String>,
    /// G2 point: [[x_c1, x_c0], [y_c1, y_c0], ["1", "0"]]
    pub pi_b: Vec<Vec<String>>,
    /// G1 point: [x, y, "1"]
    pub pi_c: Vec<String>,
}

/// Verification key for a Groth16 circuit.
#[derive(Debug, Clone, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde")]
pub struct VerificationKey {
    /// Alpha G1 point
    pub alpha: Vec<String>,
    /// Beta G2 point
    pub beta: Vec<Vec<String>>,
    /// Gamma G2 point
    pub gamma: Vec<Vec<String>>,
    /// Delta G2 point
    pub delta: Vec<Vec<String>>,
    /// IC (input commitment) G1 points — length = num_public_inputs + 1
    pub ic: Vec<Vec<String>>,
}

/// Input to the verify_proof method.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct VerifyProofInput {
    pub circuit_type: CircuitType,
    pub proof: Groth16Proof,
    pub public_signals: Vec<String>,
    /// If true, store a credential on-chain after successful verification
    #[serde(default)]
    pub store_credential: bool,
    /// Optional custom expiration in seconds from now
    pub custom_expiration: Option<u64>,
    /// Optional claim text to attach to the credential
    pub claim: Option<String>,
}

/// On-chain credential stored after successful proof verification.
#[derive(Debug, Clone, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Credential {
    pub id: String,
    pub owner: AccountId,
    pub circuit_type: CircuitType,
    pub public_signals: Vec<String>,
    pub verified_at: u64,
    pub expires_at: u64,
    pub claim: Option<String>,
}

/// Result returned from verify_proof.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct VerificationResult {
    pub valid: bool,
    pub credential_id: Option<String>,
    pub gas_used: u64,
}

/// Contract configuration.
#[derive(Debug, Clone, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ContractConfig {
    pub owner: AccountId,
    pub proposed_owner: Option<AccountId>,
    pub is_paused: bool,
    /// Default credential expiration in seconds (30 days)
    pub default_expiration_secs: u64,
    /// Required storage deposit in yoctoNEAR (0.01 NEAR)
    pub storage_cost_per_credential: u128,
}

impl ContractConfig {
    /// 30 days in seconds
    pub const DEFAULT_EXPIRATION_SECS: u64 = 30 * 24 * 60 * 60;
    /// 0.01 NEAR in yoctoNEAR
    pub const DEFAULT_STORAGE_COST: u128 = 10_000_000_000_000_000_000_000; // 1e22
}

/// Paginated credentials response.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct PaginatedCredentials {
    pub credentials: Vec<Credential>,
    pub total: u32,
    pub has_more: bool,
}

/// Contract statistics.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ContractStats {
    pub total_verifications: u64,
    pub total_credentials: u64,
    pub is_paused: bool,
    pub verification_keys_registered: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn circuit_type_as_key() {
        assert_eq!(CircuitType::VerifiedBuilder.as_key(), "verified-builder");
        assert_eq!(CircuitType::GrantTrackRecord.as_key(), "grant-track-record");
        assert_eq!(CircuitType::TeamAttestation.as_key(), "team-attestation");
    }

    #[test]
    fn circuit_type_serde_roundtrip() {
        let ct = CircuitType::GrantTrackRecord;
        let json = serde_json::to_string(&ct).unwrap();
        assert_eq!(json, "\"grant-track-record\"");
        let parsed: CircuitType = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, ct);
    }

    #[test]
    fn groth16_proof_deserialize() {
        let json = r#"{
            "pi_a": ["1", "2", "1"],
            "pi_b": [["3", "4"], ["5", "6"], ["1", "0"]],
            "pi_c": ["7", "8", "1"]
        }"#;
        let proof: Groth16Proof = serde_json::from_str(json).unwrap();
        assert_eq!(proof.pi_a.len(), 3);
        assert_eq!(proof.pi_b.len(), 3);
        assert_eq!(proof.pi_c.len(), 3);
    }
}
