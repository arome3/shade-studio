use near_sdk::serde::Serialize;
use near_sdk::AccountId;

const EVENT_STANDARD: &str = "shade-agent-registry";
const EVENT_VERSION: &str = "1.0.0";

/// Emit a NEP-297 structured event.
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
struct TemplateRegisteredData {
    template_id: String,
    creator: String,
    codehash: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct InstanceRegisteredData {
    agent_account_id: String,
    owner: String,
    template_id: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct InstanceDeactivatedData {
    agent_account_id: String,
    deactivated_by: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct AttestationRecordedData {
    agent_account_id: String,
    tee_type: String,
    codehash: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct InvocationRecordedData {
    agent_account_id: String,
    invocation_type: String,
    invocation_count: u64,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct TemplateAuditedData {
    template_id: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct ContractPausedData {
    paused: bool,
}

// ---------------------------------------------------------------------------
// Public emit functions
// ---------------------------------------------------------------------------

pub fn emit_template_registered(template_id: &str, creator: &AccountId, codehash: &str) {
    emit(
        "template_registered",
        &TemplateRegisteredData {
            template_id: template_id.to_string(),
            creator: creator.to_string(),
            codehash: codehash.to_string(),
        },
    );
}

pub fn emit_instance_registered(
    agent_account_id: &AccountId,
    owner: &AccountId,
    template_id: &str,
) {
    emit(
        "instance_registered",
        &InstanceRegisteredData {
            agent_account_id: agent_account_id.to_string(),
            owner: owner.to_string(),
            template_id: template_id.to_string(),
        },
    );
}

pub fn emit_instance_deactivated(agent_account_id: &AccountId, deactivated_by: &AccountId) {
    emit(
        "instance_deactivated",
        &InstanceDeactivatedData {
            agent_account_id: agent_account_id.to_string(),
            deactivated_by: deactivated_by.to_string(),
        },
    );
}

pub fn emit_attestation_recorded(agent_account_id: &AccountId, tee_type: &str, codehash: &str) {
    emit(
        "attestation_recorded",
        &AttestationRecordedData {
            agent_account_id: agent_account_id.to_string(),
            tee_type: tee_type.to_string(),
            codehash: codehash.to_string(),
        },
    );
}

pub fn emit_invocation_recorded(
    agent_account_id: &AccountId,
    invocation_type: &str,
    invocation_count: u64,
) {
    emit(
        "invocation_recorded",
        &InvocationRecordedData {
            agent_account_id: agent_account_id.to_string(),
            invocation_type: invocation_type.to_string(),
            invocation_count,
        },
    );
}

pub fn emit_template_audited(template_id: &str) {
    emit(
        "template_audited",
        &TemplateAuditedData {
            template_id: template_id.to_string(),
        },
    );
}

pub fn emit_contract_paused(paused: bool) {
    emit("contract_paused", &ContractPausedData { paused });
}
