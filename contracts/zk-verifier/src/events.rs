use near_sdk::serde::Serialize;
use near_sdk::AccountId;

const EVENT_STANDARD: &str = "shade-zk-verifier";
const EVENT_VERSION: &str = "1.0.0";

/// Emit a NEP-297 structured event.
///
/// Format: `EVENT_JSON:{"standard":"shade-zk-verifier","version":"1.0.0","event":"<name>","data":[{...}]}`
fn emit<T: Serialize>(event: &str, data: &T) {
    let json = serde_json::json!({
        "standard": EVENT_STANDARD,
        "version": EVENT_VERSION,
        "event": event,
        "data": [data],
    });
    near_sdk::env::log_str(&format!("EVENT_JSON:{json}"));
}

// ---------------------------------------------------------------------------
// Event data structs
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct VerificationKeySetData {
    circuit_type: String,
    updated: bool,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct ProofVerifiedData {
    circuit_type: String,
    valid: bool,
    credential_id: Option<String>,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct CredentialStoredData {
    credential_id: String,
    owner: String,
    circuit_type: String,
    expires_at: u64,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct CredentialRemovedData {
    credential_id: String,
    removed_by: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct CredentialRevokedData {
    credential_id: String,
    revoked_by: String,
    reason: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct ContractPausedData {
    paused: bool,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct OwnershipProposedData {
    current_owner: String,
    proposed_owner: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct OwnershipTransferredData {
    old_owner: String,
    new_owner: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct AdminChangedData {
    account: String,
}

// ---------------------------------------------------------------------------
// Public emit functions
// ---------------------------------------------------------------------------

pub fn emit_verification_key_set(circuit_type: &str, updated: bool) {
    emit(
        "verification_key_set",
        &VerificationKeySetData {
            circuit_type: circuit_type.to_string(),
            updated,
        },
    );
}

pub fn emit_proof_verified(circuit_type: &str, valid: bool, credential_id: Option<&str>) {
    emit(
        "proof_verified",
        &ProofVerifiedData {
            circuit_type: circuit_type.to_string(),
            valid,
            credential_id: credential_id.map(String::from),
        },
    );
}

pub fn emit_credential_stored(
    credential_id: &str,
    owner: &AccountId,
    circuit_type: &str,
    expires_at: u64,
) {
    emit(
        "credential_stored",
        &CredentialStoredData {
            credential_id: credential_id.to_string(),
            owner: owner.to_string(),
            circuit_type: circuit_type.to_string(),
            expires_at,
        },
    );
}

pub fn emit_credential_removed(credential_id: &str, removed_by: &AccountId) {
    emit(
        "credential_removed",
        &CredentialRemovedData {
            credential_id: credential_id.to_string(),
            removed_by: removed_by.to_string(),
        },
    );
}

pub fn emit_credential_revoked(credential_id: &str, revoked_by: &AccountId, reason: &str) {
    emit(
        "credential_revoked",
        &CredentialRevokedData {
            credential_id: credential_id.to_string(),
            revoked_by: revoked_by.to_string(),
            reason: reason.to_string(),
        },
    );
}

pub fn emit_contract_paused(paused: bool) {
    emit("contract_paused", &ContractPausedData { paused });
}

pub fn emit_ownership_proposed(current_owner: &AccountId, proposed_owner: &AccountId) {
    emit(
        "ownership_proposed",
        &OwnershipProposedData {
            current_owner: current_owner.to_string(),
            proposed_owner: proposed_owner.to_string(),
        },
    );
}

pub fn emit_ownership_transferred(old_owner: &AccountId, new_owner: &AccountId) {
    emit(
        "ownership_transferred",
        &OwnershipTransferredData {
            old_owner: old_owner.to_string(),
            new_owner: new_owner.to_string(),
        },
    );
}

pub fn emit_admin_added(account: &AccountId) {
    emit(
        "admin_added",
        &AdminChangedData {
            account: account.to_string(),
        },
    );
}

pub fn emit_admin_removed(account: &AccountId) {
    emit(
        "admin_removed",
        &AdminChangedData {
            account: account.to_string(),
        },
    );
}
