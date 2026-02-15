use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::AccountId;

/// Agent capability types.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde", rename_all = "kebab-case")]
pub enum Capability {
    ReadDocuments,
    WriteDocuments,
    AiChat,
    AiAnalysis,
    BlockchainRead,
    BlockchainWrite,
    IpfsRead,
    IpfsWrite,
    SocialRead,
    SocialWrite,
}

impl Capability {
    pub fn as_str(&self) -> &'static str {
        match self {
            Capability::ReadDocuments => "read-documents",
            Capability::WriteDocuments => "write-documents",
            Capability::AiChat => "ai-chat",
            Capability::AiAnalysis => "ai-analysis",
            Capability::BlockchainRead => "blockchain-read",
            Capability::BlockchainWrite => "blockchain-write",
            Capability::IpfsRead => "ipfs-read",
            Capability::IpfsWrite => "ipfs-write",
            Capability::SocialRead => "social-read",
            Capability::SocialWrite => "social-write",
        }
    }
}

/// Agent instance lifecycle status.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde", rename_all = "kebab-case")]
pub enum AgentStatus {
    Active,
    Paused,
    Deactivated,
}

impl AgentStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            AgentStatus::Active => "active",
            AgentStatus::Paused => "paused",
            AgentStatus::Deactivated => "deactivated",
        }
    }
}

/// Permission definition for FunctionCall access keys.
#[derive(Debug, Clone, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Permission {
    pub receiver_id: String,
    pub method_names: Vec<String>,
    pub allowance: String,
    pub purpose: String,
}

/// Agent template registered in the registry.
#[derive(Debug, Clone, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Template {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub codehash: String,
    pub source_url: String,
    pub audit_url: Option<String>,
    pub creator: AccountId,
    pub capabilities: Vec<Capability>,
    pub required_permissions: Vec<Permission>,
    pub created_at: u64,
    pub deployments: u64,
    pub is_audited: bool,
}

/// TEE codehash attestation.
#[derive(Debug, Clone, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Attestation {
    pub codehash: String,
    pub tee_type: String,
    pub attestation_document: String,
    pub signature: String,
    pub timestamp: u64,
    pub verified: bool,
}

/// Deployed agent instance.
#[derive(Debug, Clone, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Instance {
    pub account_id: AccountId,
    pub owner_account_id: AccountId,
    pub template_id: String,
    pub codehash: String,
    pub name: String,
    pub status: AgentStatus,
    pub last_active_at: Option<u64>,
    pub deployed_at: u64,
    pub last_attestation: Option<Attestation>,
    pub invocation_count: u64,
    pub capabilities: Vec<Capability>,
}

/// Verification result returned by verify_instance.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct VerificationResult {
    pub valid: bool,
    pub reason: Option<String>,
    pub is_audited: bool,
    pub attestation: Option<Attestation>,
}

/// Registry statistics.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Stats {
    pub total_templates: u64,
    pub total_deployments: u64,
    pub verified_codehashes: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capability_serde_roundtrip() {
        let cap = Capability::AiAnalysis;
        let json = serde_json::to_string(&cap).unwrap();
        assert_eq!(json, "\"ai-analysis\"");
        let parsed: Capability = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cap);
    }

    #[test]
    fn agent_status_serde_roundtrip() {
        let status = AgentStatus::Active;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"active\"");
        let parsed: AgentStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, status);
    }
}
