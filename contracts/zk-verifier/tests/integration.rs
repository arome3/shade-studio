use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, AccountId, NearToken};
use zk_verifier::*;

fn owner() -> AccountId {
    "owner.testnet".parse().unwrap()
}

fn alice() -> AccountId {
    "alice.testnet".parse().unwrap()
}

fn bob() -> AccountId {
    "bob.testnet".parse().unwrap()
}

fn setup(predecessor: &AccountId) {
    let context = VMContextBuilder::new()
        .predecessor_account_id(predecessor.clone())
        .block_timestamp(1_700_000_000 * 1_000_000_000)
        .block_height(100)
        .build();
    testing_env!(context);
}

#[allow(dead_code)]
fn setup_with_deposit(predecessor: &AccountId, deposit: u128) {
    let context = VMContextBuilder::new()
        .predecessor_account_id(predecessor.clone())
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .block_timestamp(1_700_000_000 * 1_000_000_000)
        .block_height(100)
        .build();
    testing_env!(context);
}

/// Create a minimal mock verification key.
/// Note: These are NOT valid BN254 points — they are for testing
/// contract logic (auth, storage, config) not cryptographic correctness.
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

// ==========================================================================
// Existing tests
// ==========================================================================

#[test]
fn full_lifecycle() {
    setup(&owner());
    let mut contract = ZKVerifier::new(owner());

    contract.set_verification_key(CircuitType::VerifiedBuilder, mock_vk());
    assert!(contract.has_verification_key(CircuitType::VerifiedBuilder));

    let stats = contract.get_stats();
    assert_eq!(stats.verification_keys_registered, 1);
    assert_eq!(stats.total_verifications, 0);
}

#[test]
fn config_management() {
    setup(&owner());
    let mut contract = ZKVerifier::new(owner());

    let cfg = contract.get_config();
    assert_eq!(cfg.default_expiration_secs, 30 * 24 * 60 * 60);
    assert!(!cfg.is_paused);

    contract.set_default_expiration(7 * 24 * 60 * 60);
    let cfg = contract.get_config();
    assert_eq!(cfg.default_expiration_secs, 7 * 24 * 60 * 60);

    contract.set_paused(true);
    assert!(contract.get_stats().is_paused);
    contract.set_paused(false);
    assert!(!contract.get_stats().is_paused);
}

// ==========================================================================
// Fix 6: Two-step ownership transfer
// ==========================================================================

#[test]
fn two_step_ownership_transfer() {
    setup(&owner());
    let mut contract = ZKVerifier::new(owner());

    // Propose
    contract.propose_owner(alice());
    let cfg = contract.get_config();
    assert_eq!(cfg.proposed_owner, Some(alice()));

    // Accept (as alice)
    setup(&alice());
    contract.accept_ownership();
    let cfg = contract.get_config();
    assert_eq!(cfg.owner, alice());
    assert_eq!(cfg.proposed_owner, None);

    // Alice can now set VK
    contract.set_verification_key(CircuitType::TeamAttestation, mock_vk());
    assert!(contract.has_verification_key(CircuitType::TeamAttestation));
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn accept_ownership_wrong_account() {
    setup(&owner());
    let mut contract = ZKVerifier::new(owner());
    contract.propose_owner(alice());

    // Bob tries to accept — should fail
    setup(&bob());
    contract.accept_ownership();
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn accept_ownership_no_proposal() {
    setup(&owner());
    let mut contract = ZKVerifier::new(owner());

    // No proposal exists — should fail
    setup(&alice());
    contract.accept_ownership();
}

// ==========================================================================
// Fix 6: Admin roles
// ==========================================================================

#[test]
fn admin_can_set_vk() {
    setup(&owner());
    let mut contract = ZKVerifier::new(owner());
    contract.add_admin(alice());
    assert!(contract.is_admin(alice()));

    setup(&alice());
    contract.set_verification_key(CircuitType::VerifiedBuilder, mock_vk());
    assert!(contract.has_verification_key(CircuitType::VerifiedBuilder));
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn admin_cannot_transfer_ownership() {
    setup(&owner());
    let mut contract = ZKVerifier::new(owner());
    contract.add_admin(alice());

    setup(&alice());
    contract.propose_owner(alice());
}

#[test]
fn owner_can_remove_admin() {
    setup(&owner());
    let mut contract = ZKVerifier::new(owner());
    contract.add_admin(alice());
    assert!(contract.is_admin(alice()));

    contract.remove_admin(alice());
    assert!(!contract.is_admin(alice()));
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn removed_admin_cannot_set_vk() {
    setup(&owner());
    let mut contract = ZKVerifier::new(owner());
    contract.add_admin(alice());
    contract.remove_admin(alice());

    setup(&alice());
    contract.set_verification_key(CircuitType::VerifiedBuilder, mock_vk());
}

// ==========================================================================
// Fix 7: Credential revocation (logic-level, not proof-level)
// ==========================================================================

#[test]
fn revoke_nonexistent_credential() {
    setup(&owner());
    let mut contract = ZKVerifier::new(owner());

    // Revoking a non-existent credential should still mark it as revoked
    contract.revoke_credential("cred-fake".into(), "test".into());
    assert!(contract.is_credential_revoked("cred-fake".into()));
    // is_credential_valid should return Some(false) for a revoked ID
    assert_eq!(contract.is_credential_valid("cred-fake".into()), Some(false));
}

// ==========================================================================
// Fix 5: Pagination
// ==========================================================================

#[test]
fn pagination_empty_owner() {
    setup(&owner());
    let contract = ZKVerifier::new(owner());

    let result = contract.get_credentials_by_owner(alice(), None, None, None);
    assert_eq!(result.total, 0);
    assert!(result.credentials.is_empty());
    assert!(!result.has_more);
}

// ==========================================================================
// Existing guard tests
// ==========================================================================

#[test]
#[should_panic(expected = "Unauthorized")]
fn owner_guard() {
    setup(&owner());
    let mut contract = ZKVerifier::new(owner());

    setup(&bob());
    contract.set_verification_key(CircuitType::VerifiedBuilder, mock_vk());
}

#[test]
#[should_panic(expected = "paused")]
fn pause_guard() {
    setup(&owner());
    let mut contract = ZKVerifier::new(owner());
    contract.set_verification_key(CircuitType::VerifiedBuilder, mock_vk());
    contract.set_paused(true);

    contract.set_verification_key(CircuitType::GrantTrackRecord, mock_vk());
}

#[test]
fn credentials_empty_for_new_owner() {
    setup(&owner());
    let contract = ZKVerifier::new(owner());

    let result = contract.get_credentials_by_owner(alice(), None, None, None);
    assert!(result.credentials.is_empty());
}

#[test]
fn storage_cost_view() {
    setup(&owner());
    let contract = ZKVerifier::new(owner());

    let cost = contract.get_storage_cost();
    assert_eq!(cost, "10000000000000000000000");
}

#[test]
fn multiple_circuit_vks() {
    setup(&owner());
    let mut contract = ZKVerifier::new(owner());

    contract.set_verification_key(CircuitType::VerifiedBuilder, mock_vk());
    contract.set_verification_key(CircuitType::GrantTrackRecord, mock_vk());
    contract.set_verification_key(CircuitType::TeamAttestation, mock_vk());

    assert!(contract.has_verification_key(CircuitType::VerifiedBuilder));
    assert!(contract.has_verification_key(CircuitType::GrantTrackRecord));
    assert!(contract.has_verification_key(CircuitType::TeamAttestation));

    let stats = contract.get_stats();
    assert_eq!(stats.verification_keys_registered, 3);
}

#[test]
fn update_existing_vk() {
    setup(&owner());
    let mut contract = ZKVerifier::new(owner());

    contract.set_verification_key(CircuitType::VerifiedBuilder, mock_vk());
    contract.set_verification_key(CircuitType::VerifiedBuilder, mock_vk());

    let stats = contract.get_stats();
    assert_eq!(stats.verification_keys_registered, 1);
}
