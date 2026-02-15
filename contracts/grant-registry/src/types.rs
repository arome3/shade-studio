use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::AccountId;

/// Blockchain ecosystem.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde", rename_all = "kebab-case")]
pub enum Chain {
    Near,
    Ethereum,
    Optimism,
    Arbitrum,
    Polygon,
    Base,
    Solana,
    Multichain,
}

/// Grant category.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde", rename_all = "kebab-case")]
pub enum Category {
    Defi,
    Infrastructure,
    Tooling,
    Social,
    Gaming,
    Nft,
    Dao,
    Privacy,
    Education,
    PublicGoods,
    Other,
}

/// Grant program lifecycle status.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde", rename_all = "kebab-case")]
pub enum ProgramStatus {
    Active,
    Upcoming,
    Closed,
    Paused,
}

/// Application lifecycle status.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde", rename_all = "kebab-case")]
pub enum ApplicationStatus {
    Draft,
    Submitted,
    UnderReview,
    Approved,
    Rejected,
    Funded,
    Completed,
}

/// Team member on a project.
#[derive(Debug, Clone, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde")]
pub struct TeamMember {
    pub account_id: String,
    pub name: String,
    pub role: String,
    pub profile_url: Option<String>,
}

/// A grant program registered in the registry.
#[derive(Debug, Clone, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Program {
    pub id: String,
    pub name: String,
    pub description: String,
    pub organization: String,
    pub chains: Vec<Chain>,
    pub categories: Vec<Category>,
    pub funding_pool: String,
    pub min_amount: Option<String>,
    pub max_amount: Option<String>,
    pub deadline: Option<String>,
    pub website: String,
    pub application_url: Option<String>,
    pub status: ProgramStatus,
    pub registered_by: AccountId,
    pub registered_at: u64,
    pub application_count: u64,
    pub funded_count: u64,
}

/// A project registered in the registry.
#[derive(Debug, Clone, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    pub website: Option<String>,
    pub team_members: Vec<TeamMember>,
    pub registered_by: AccountId,
    pub registered_at: u64,
    pub total_funded: String,
    pub application_count: u64,
    pub success_rate: u32,
}

/// A grant application linking a project to a program.
#[derive(Debug, Clone, Serialize, Deserialize, BorshDeserialize, BorshSerialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Application {
    pub id: String,
    pub program_id: String,
    pub project_id: String,
    pub applicant_account_id: AccountId,
    pub title: String,
    pub requested_amount: String,
    pub status: ApplicationStatus,
    pub submitted_at: Option<u64>,
    pub funded_amount: Option<String>,
    pub completed_at: Option<u64>,
}

/// Ecosystem-wide statistics.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct EcosystemStats {
    pub total_programs: u64,
    pub total_projects: u64,
    pub total_funded: String,
    pub total_applications: u64,
    pub active_programs: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chain_serde_roundtrip() {
        let chain = Chain::Near;
        let json = serde_json::to_string(&chain).unwrap();
        assert_eq!(json, "\"near\"");
        let parsed: Chain = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, chain);
    }

    #[test]
    fn category_serde_roundtrip() {
        let cat = Category::PublicGoods;
        let json = serde_json::to_string(&cat).unwrap();
        assert_eq!(json, "\"public-goods\"");
        let parsed: Category = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cat);
    }

    #[test]
    fn program_status_serde_roundtrip() {
        let status = ProgramStatus::Active;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"active\"");
        let parsed: ProgramStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, status);
    }

    #[test]
    fn application_status_serde_roundtrip() {
        let status = ApplicationStatus::UnderReview;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"under-review\"");
        let parsed: ApplicationStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, status);
    }
}
