mod errors;
mod events;
mod storage;
mod types;
mod verifier;

use near_sdk::store::{LookupMap, LookupSet, IterableSet};
use near_sdk::{env, near, AccountId, FunctionError, PanicOnDefault};

use errors::ContractError;
use storage::StorageKey;

// Re-export public types for integration tests and downstream consumers
pub use types::{
    CircuitType, ContractConfig, ContractStats, Credential, Groth16Proof,
    PaginatedCredentials, VerificationKey, VerifyProofInput, VerificationResult,
};

/// ZK Groth16 proof verifier and credential storage contract for NEAR.
///
/// Provides:
/// - On-chain Groth16 proof verification using arkworks (pure WASM)
/// - Credential storage with per-owner indexing and expiration
/// - Admin controls: pause, verification key management, config
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct ZKVerifier {
    /// Contract owner with admin privileges
    owner: AccountId,
    /// Proposed new owner (two-step transfer)
    proposed_owner: Option<AccountId>,
    /// Admin accounts that can manage VKs and revoke credentials
    admins: LookupSet<AccountId>,
    /// Whether the contract is paused
    is_paused: bool,
    /// Default credential expiration in seconds
    default_expiration_secs: u64,
    /// Required storage deposit per credential (yoctoNEAR)
    storage_cost_per_credential: u128,
    /// Verification keys per circuit type
    verification_keys: LookupMap<String, VerificationKey>,
    /// Credentials by ID
    credentials: LookupMap<String, Credential>,
    /// Credential ID sets by owner account
    credentials_by_owner: LookupMap<AccountId, IterableSet<String>>,
    /// Total number of proof verifications performed
    total_verifications: u64,
    /// Total number of stored credentials
    total_credentials: u64,
    /// Number of registered verification keys
    vk_count: u32,
    /// Monotonic nonce for generating unique credential IDs
    credential_nonce: u64,
    /// Set of revoked credential IDs (tombstones)
    revoked_credentials: LookupSet<String>,
}

#[near]
impl ZKVerifier {
    // =========================================================================
    // Initialization
    // =========================================================================

    /// Initialize the contract with an owner account.
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            owner,
            proposed_owner: None,
            admins: LookupSet::new(borsh::to_vec(&StorageKey::Admins).unwrap()),
            is_paused: false,
            default_expiration_secs: ContractConfig::DEFAULT_EXPIRATION_SECS,
            storage_cost_per_credential: ContractConfig::DEFAULT_STORAGE_COST,
            verification_keys: LookupMap::new(
                borsh::to_vec(&StorageKey::VerificationKeys).unwrap(),
            ),
            credentials: LookupMap::new(borsh::to_vec(&StorageKey::Credentials).unwrap()),
            credentials_by_owner: LookupMap::new(
                borsh::to_vec(&StorageKey::CredentialsByOwner).unwrap(),
            ),
            total_verifications: 0,
            total_credentials: 0,
            vk_count: 0,
            credential_nonce: 0,
            revoked_credentials: LookupSet::new(
                borsh::to_vec(&StorageKey::RevokedCredentials).unwrap(),
            ),
        }
    }

    // =========================================================================
    // Admin methods
    // =========================================================================

    /// Register or update a verification key for a circuit type.
    /// Callable by owner or admin.
    pub fn set_verification_key(&mut self, circuit_type: CircuitType, vk: VerificationKey) {
        self.assert_owner_or_admin();
        self.assert_not_paused();

        // Basic validation: IC must have at least 1 element
        if vk.ic.is_empty() {
            ContractError::InvalidVerificationKey("IC array must not be empty".into()).panic();
        }

        let key = circuit_type.as_key();
        let is_new = self.verification_keys.get(&key).is_none();
        self.verification_keys.insert(key, vk);

        let updated = !is_new;
        if is_new {
            self.vk_count += 1;
        }

        events::emit_verification_key_set(&circuit_type.as_key(), updated);
    }

    /// Pause or unpause the contract.
    pub fn set_paused(&mut self, paused: bool) {
        self.assert_owner();
        self.is_paused = paused;
        events::emit_contract_paused(paused);
    }

    /// Propose ownership transfer to a new account (step 1 of 2).
    /// Only callable by the current owner.
    pub fn propose_owner(&mut self, new_owner: AccountId) {
        self.assert_owner();
        events::emit_ownership_proposed(&self.owner, &new_owner);
        self.proposed_owner = Some(new_owner);
    }

    /// Accept ownership transfer (step 2 of 2).
    /// Only callable by the proposed new owner.
    pub fn accept_ownership(&mut self) {
        let caller = env::predecessor_account_id();
        let proposed = self.proposed_owner.as_ref().unwrap_or_else(|| {
            ContractError::Unauthorized.panic()
        });
        if &caller != proposed {
            ContractError::Unauthorized.panic();
        }
        let old_owner = self.owner.clone();
        self.owner = caller;
        self.proposed_owner = None;
        events::emit_ownership_transferred(&old_owner, &self.owner);
    }

    /// Add an admin account. Only callable by the owner.
    pub fn add_admin(&mut self, account: AccountId) {
        self.assert_owner();
        self.admins.insert(account.clone());
        events::emit_admin_added(&account);
    }

    /// Remove an admin account. Only callable by the owner.
    pub fn remove_admin(&mut self, account: AccountId) {
        self.assert_owner();
        self.admins.remove(&account);
        events::emit_admin_removed(&account);
    }

    /// Check if an account is an admin.
    pub fn is_admin(&self, account: AccountId) -> bool {
        self.admins.contains(&account)
    }

    /// Update the default credential expiration period.
    pub fn set_default_expiration(&mut self, seconds: u64) {
        self.assert_owner();
        self.default_expiration_secs = seconds;
    }

    // =========================================================================
    // Verification methods
    // =========================================================================

    /// Verify a Groth16 proof on-chain.
    /// Optionally stores a credential if `store_credential` is true in the input.
    /// When storing, the caller must attach sufficient deposit.
    #[payable]
    pub fn verify_proof(&mut self, input: VerifyProofInput) -> VerificationResult {
        self.assert_not_paused();

        let gas_before = env::used_gas().as_gas();

        // Get the verification key
        let key = input.circuit_type.as_key();
        let vk = self
            .verification_keys
            .get(&key)
            .unwrap_or_else(|| {
                ContractError::VerificationKeyNotFound(key.clone()).panic()
            })
            .clone();

        // Run Groth16 verification
        let is_valid = match verifier::verify_groth16_proof(
            &vk,
            &input.proof,
            &input.public_signals,
        ) {
            Ok(valid) => valid,
            Err(_) => false,
        };

        self.total_verifications += 1;

        let mut credential_id = None;

        // Store credential if requested and proof is valid
        if is_valid && input.store_credential {
            let deposit = env::attached_deposit();
            if deposit.as_yoctonear() < self.storage_cost_per_credential {
                ContractError::InsufficientDeposit {
                    required: self.storage_cost_per_credential,
                    attached: deposit.as_yoctonear(),
                }
                .panic();
            }

            let caller = env::predecessor_account_id();
            let now_secs = env::block_timestamp() / 1_000_000_000;
            let expiry = input
                .custom_expiration
                .unwrap_or(self.default_expiration_secs);

            self.credential_nonce += 1;
            let circuit_key = input.circuit_type.as_key();
            let id = storage::generate_credential_id(&caller, &input.circuit_type, self.credential_nonce);
            let expires_at = now_secs + expiry;
            let cred_owner = caller.clone();
            let credential = Credential {
                id: id.clone(),
                owner: caller,
                circuit_type: input.circuit_type,
                public_signals: input.public_signals,
                verified_at: now_secs,
                expires_at,
                claim: input.claim,
            };

            storage::store_credential(
                &mut self.credentials,
                &mut self.credentials_by_owner,
                credential,
            );

            self.total_credentials += 1;
            credential_id = Some(id.clone());

            events::emit_credential_stored(&id, &cred_owner, &circuit_key, expires_at);
        }

        events::emit_proof_verified(
            &key,
            is_valid,
            credential_id.as_deref(),
        );

        let gas_after = env::used_gas().as_gas();

        VerificationResult {
            valid: is_valid,
            credential_id,
            gas_used: gas_after.saturating_sub(gas_before),
        }
    }

    /// View-only verification — does not store anything.
    pub fn verify_proof_view(&self, input: VerifyProofInput) -> VerificationResult {
        self.assert_not_paused();

        let gas_before = env::used_gas().as_gas();

        let key = input.circuit_type.as_key();
        let vk = self
            .verification_keys
            .get(&key)
            .unwrap_or_else(|| {
                ContractError::VerificationKeyNotFound(key).panic()
            })
            .clone();

        let is_valid = match verifier::verify_groth16_proof(
            &vk,
            &input.proof,
            &input.public_signals,
        ) {
            Ok(valid) => valid,
            Err(_) => false,
        };

        let gas_after = env::used_gas().as_gas();

        VerificationResult {
            valid: is_valid,
            credential_id: None,
            gas_used: gas_after.saturating_sub(gas_before),
        }
    }

    // =========================================================================
    // Credential queries
    // =========================================================================

    /// Get a credential by ID.
    pub fn get_credential(&self, credential_id: String) -> Option<Credential> {
        self.credentials.get(&credential_id).cloned()
    }

    /// Check if a credential exists, is not expired, and is not revoked.
    pub fn is_credential_valid(&self, credential_id: String) -> Option<bool> {
        if self.revoked_credentials.contains(&credential_id) {
            return Some(false);
        }
        storage::is_credential_valid(&self.credentials, &credential_id)
    }

    /// Get credentials for an owner account with pagination.
    pub fn get_credentials_by_owner(
        &self,
        owner: AccountId,
        include_expired: Option<bool>,
        offset: Option<u32>,
        limit: Option<u32>,
    ) -> PaginatedCredentials {
        let (credentials, total) = storage::get_credentials_by_owner(
            &self.credentials,
            &self.credentials_by_owner,
            &owner,
            include_expired.unwrap_or(false),
            offset.unwrap_or(0),
            limit.unwrap_or(50),
        );
        let has_more = (offset.unwrap_or(0) + credentials.len() as u32) < total;
        PaginatedCredentials {
            credentials,
            total,
            has_more,
        }
    }

    /// Remove a credential. Only the credential owner can do this.
    pub fn remove_credential(&mut self, credential_id: String) -> bool {
        self.assert_not_paused();
        let caller = env::predecessor_account_id();
        let removed = storage::remove_credential(
            &mut self.credentials,
            &mut self.credentials_by_owner,
            &credential_id,
            &caller,
        );
        if removed {
            self.total_credentials = self.total_credentials.saturating_sub(1);
            events::emit_credential_removed(&credential_id, &caller);
        }
        removed
    }

    /// Revoke a credential. Only callable by owner or admin.
    /// Removes the credential data and marks the ID as permanently revoked.
    pub fn revoke_credential(&mut self, credential_id: String, reason: String) {
        self.assert_owner_or_admin();
        self.assert_not_paused();

        // Remove from storage if it exists
        if let Some(cred) = self.credentials.get(&credential_id) {
            let cred_owner = cred.owner.clone();
            self.credentials.remove(&credential_id);
            if let Some(owner_set) = self.credentials_by_owner.get_mut(&cred_owner) {
                owner_set.remove(&credential_id);
            }
            self.total_credentials = self.total_credentials.saturating_sub(1);
        }

        // Mark as revoked (tombstone)
        self.revoked_credentials.insert(credential_id.clone());

        let caller = env::predecessor_account_id();
        events::emit_credential_revoked(&credential_id, &caller, &reason);
    }

    /// Check if a credential has been revoked.
    pub fn is_credential_revoked(&self, credential_id: String) -> bool {
        self.revoked_credentials.contains(&credential_id)
    }

    // =========================================================================
    // View methods
    // =========================================================================

    /// Get the contract configuration.
    pub fn get_config(&self) -> ContractConfig {
        ContractConfig {
            owner: self.owner.clone(),
            proposed_owner: self.proposed_owner.clone(),
            is_paused: self.is_paused,
            default_expiration_secs: self.default_expiration_secs,
            storage_cost_per_credential: self.storage_cost_per_credential,
        }
    }

    /// Get contract statistics.
    pub fn get_stats(&self) -> ContractStats {
        ContractStats {
            total_verifications: self.total_verifications,
            total_credentials: self.total_credentials,
            is_paused: self.is_paused,
            verification_keys_registered: self.vk_count,
        }
    }

    /// Check if a verification key is registered for a circuit type.
    pub fn has_verification_key(&self, circuit_type: CircuitType) -> bool {
        self.verification_keys.get(&circuit_type.as_key()).is_some()
    }

    /// Get the required storage deposit for storing a credential.
    pub fn get_storage_cost(&self) -> String {
        self.storage_cost_per_credential.to_string()
    }

    // =========================================================================
    // Internal helpers
    // =========================================================================

    fn assert_owner(&self) {
        if env::predecessor_account_id() != self.owner {
            ContractError::Unauthorized.panic();
        }
    }

    fn assert_owner_or_admin(&self) {
        let caller = env::predecessor_account_id();
        if caller != self.owner && !self.admins.contains(&caller) {
            ContractError::Unauthorized.panic();
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

    fn setup_context(predecessor: &AccountId) {
        let context = VMContextBuilder::new()
            .predecessor_account_id(predecessor.clone())
            .block_timestamp(1_700_000_000 * 1_000_000_000) // ~Nov 2023 in nanoseconds
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

    fn mock_vk() -> VerificationKey {
        VerificationKey {
            alpha: vec!["1".into(), "2".into()],
            beta: vec![
                vec!["10857046999023057135944570762232829481370756359578518086990519993285655852781".into(),
                     "11559732032986387107991004021392285783925812861821192530917403151452391805634".into()],
                vec!["8495653923123431417604973247489272438418190587263600148770280649306958101930".into(),
                     "4082367875863433681332203403145435568316851327593401208105741076214120093531".into()],
            ],
            gamma: vec![
                vec!["10857046999023057135944570762232829481370756359578518086990519993285655852781".into(),
                     "11559732032986387107991004021392285783925812861821192530917403151452391805634".into()],
                vec!["8495653923123431417604973247489272438418190587263600148770280649306958101930".into(),
                     "4082367875863433681332203403145435568316851327593401208105741076214120093531".into()],
            ],
            delta: vec![
                vec!["10857046999023057135944570762232829481370756359578518086990519993285655852781".into(),
                     "11559732032986387107991004021392285783925812861821192530917403151452391805634".into()],
                vec!["8495653923123431417604973247489272438418190587263600148770280649306958101930".into(),
                     "4082367875863433681332203403145435568316851327593401208105741076214120093531".into()],
            ],
            ic: vec![
                vec!["1".into(), "2".into()],
                vec!["1".into(), "2".into()],
            ],
        }
    }

    #[test]
    fn test_init() {
        setup_context(&owner());
        let contract = ZKVerifier::new(owner());
        assert_eq!(contract.owner, owner());
        assert!(!contract.is_paused);

        let stats = contract.get_stats();
        assert_eq!(stats.total_verifications, 0);
        assert_eq!(stats.total_credentials, 0);
    }

    #[test]
    fn test_set_verification_key() {
        setup_context(&owner());
        let mut contract = ZKVerifier::new(owner());

        assert!(!contract.has_verification_key(CircuitType::VerifiedBuilder));

        contract.set_verification_key(CircuitType::VerifiedBuilder, mock_vk());
        assert!(contract.has_verification_key(CircuitType::VerifiedBuilder));
        assert!(!contract.has_verification_key(CircuitType::GrantTrackRecord));

        let stats = contract.get_stats();
        assert_eq!(stats.verification_keys_registered, 1);
    }

    #[test]
    #[should_panic(expected = "Unauthorized")]
    fn test_set_verification_key_unauthorized() {
        setup_context(&owner());
        let mut contract = ZKVerifier::new(owner());

        setup_context(&alice());
        contract.set_verification_key(CircuitType::VerifiedBuilder, mock_vk());
    }

    #[test]
    fn test_pause_unpause() {
        setup_context(&owner());
        let mut contract = ZKVerifier::new(owner());

        contract.set_paused(true);
        assert!(contract.get_config().is_paused);

        contract.set_paused(false);
        assert!(!contract.get_config().is_paused);
    }

    #[test]
    #[should_panic(expected = "Unauthorized")]
    fn test_pause_unauthorized() {
        setup_context(&owner());
        let mut contract = ZKVerifier::new(owner());

        setup_context(&alice());
        contract.set_paused(true);
    }

    #[test]
    fn test_two_step_ownership() {
        setup_context(&owner());
        let mut contract = ZKVerifier::new(owner());

        // Step 1: propose
        contract.propose_owner(alice());
        assert_eq!(contract.get_config().proposed_owner, Some(alice()));

        // Step 2: accept (as alice)
        setup_context(&alice());
        contract.accept_ownership();
        assert_eq!(contract.get_config().owner, alice());
        assert_eq!(contract.get_config().proposed_owner, None);
    }

    #[test]
    #[should_panic(expected = "Unauthorized")]
    fn test_accept_ownership_wrong_account() {
        setup_context(&owner());
        let mut contract = ZKVerifier::new(owner());
        contract.propose_owner(alice());

        // Bob tries to accept — should fail
        setup_context(&"bob.testnet".parse::<AccountId>().unwrap());
        contract.accept_ownership();
    }

    #[test]
    fn test_admin_can_set_vk() {
        setup_context(&owner());
        let mut contract = ZKVerifier::new(owner());
        contract.add_admin(alice());
        assert!(contract.is_admin(alice()));

        // Admin sets VK
        setup_context(&alice());
        contract.set_verification_key(CircuitType::VerifiedBuilder, mock_vk());
        assert!(contract.has_verification_key(CircuitType::VerifiedBuilder));
    }

    #[test]
    #[should_panic(expected = "Unauthorized")]
    fn test_admin_cannot_transfer_ownership() {
        setup_context(&owner());
        let mut contract = ZKVerifier::new(owner());
        contract.add_admin(alice());

        // Admin tries to propose ownership — should fail
        setup_context(&alice());
        contract.propose_owner(alice());
    }

    #[test]
    fn test_get_config() {
        setup_context(&owner());
        let contract = ZKVerifier::new(owner());

        let cfg = contract.get_config();
        assert_eq!(cfg.owner, owner());
        assert!(!cfg.is_paused);
        assert_eq!(cfg.default_expiration_secs, 30 * 24 * 60 * 60);
        assert_eq!(cfg.storage_cost_per_credential, 10_000_000_000_000_000_000_000);
    }

    #[test]
    fn test_credential_not_found() {
        setup_context(&owner());
        let contract = ZKVerifier::new(owner());

        assert!(contract.get_credential("nonexistent".into()).is_none());
        assert!(contract.is_credential_valid("nonexistent".into()).is_none());
    }

    #[test]
    fn test_get_storage_cost() {
        setup_context(&owner());
        let contract = ZKVerifier::new(owner());

        let cost = contract.get_storage_cost();
        assert_eq!(cost, "10000000000000000000000");
    }

    #[test]
    #[should_panic(expected = "paused")]
    fn test_verify_when_paused() {
        setup_context(&owner());
        let mut contract = ZKVerifier::new(owner());
        contract.set_verification_key(CircuitType::VerifiedBuilder, mock_vk());
        contract.set_paused(true);

        setup_context_with_deposit(&alice(), 0);
        contract.verify_proof(VerifyProofInput {
            circuit_type: CircuitType::VerifiedBuilder,
            proof: Groth16Proof {
                pi_a: vec!["1".into(), "2".into(), "1".into()],
                pi_b: vec![
                    vec!["1".into(), "0".into()],
                    vec!["0".into(), "1".into()],
                    vec!["1".into(), "0".into()],
                ],
                pi_c: vec!["1".into(), "2".into(), "1".into()],
            },
            public_signals: vec!["1".into()],
            store_credential: false,
            custom_expiration: None,
            claim: None,
        });
    }

    #[test]
    fn test_credential_operations() {
        setup_context(&owner());
        let contract = ZKVerifier::new(owner());

        // Directly test credential storage without proof verification
        // (since we'd need valid curve points for that)
        let result = contract.get_credentials_by_owner(alice(), None, None, None);
        assert!(result.credentials.is_empty());
        assert_eq!(result.total, 0);
        assert!(!result.has_more);
    }
}
