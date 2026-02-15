use near_sdk::serde::Serialize;
use near_sdk::AccountId;

const EVENT_STANDARD: &str = "grant-registry";
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
struct ProgramRegisteredData {
    program_id: String,
    organization: String,
    registered_by: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct ProjectRegisteredData {
    project_id: String,
    registered_by: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct ApplicationRecordedData {
    application_id: String,
    program_id: String,
    project_id: String,
    applicant: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct ApplicationUpdatedData {
    application_id: String,
    new_status: String,
    updated_by: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct ContractPausedData {
    paused: bool,
}

// ---------------------------------------------------------------------------
// Public emit functions
// ---------------------------------------------------------------------------

pub fn emit_program_registered(
    program_id: &str,
    organization: &str,
    registered_by: &AccountId,
) {
    emit(
        "program_registered",
        &ProgramRegisteredData {
            program_id: program_id.to_string(),
            organization: organization.to_string(),
            registered_by: registered_by.to_string(),
        },
    );
}

pub fn emit_project_registered(project_id: &str, registered_by: &AccountId) {
    emit(
        "project_registered",
        &ProjectRegisteredData {
            project_id: project_id.to_string(),
            registered_by: registered_by.to_string(),
        },
    );
}

pub fn emit_application_recorded(
    application_id: &str,
    program_id: &str,
    project_id: &str,
    applicant: &AccountId,
) {
    emit(
        "application_recorded",
        &ApplicationRecordedData {
            application_id: application_id.to_string(),
            program_id: program_id.to_string(),
            project_id: project_id.to_string(),
            applicant: applicant.to_string(),
        },
    );
}

pub fn emit_application_updated(
    application_id: &str,
    new_status: &str,
    updated_by: &AccountId,
) {
    emit(
        "application_updated",
        &ApplicationUpdatedData {
            application_id: application_id.to_string(),
            new_status: new_status.to_string(),
            updated_by: updated_by.to_string(),
        },
    );
}

pub fn emit_contract_paused(paused: bool) {
    emit("contract_paused", &ContractPausedData { paused });
}
