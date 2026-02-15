use near_sdk::serde::Serialize;
use near_sdk::AccountId;

const EVENT_STANDARD: &str = "shade-async-ai";
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
struct JobSubmittedData {
    job_id: String,
    owner: String,
    job_type: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct JobClaimedData {
    job_id: String,
    worker: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct JobCheckpointedData {
    job_id: String,
    progress: u8,
    step: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct JobResumedData {
    job_id: String,
    worker: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct JobCompletedData {
    job_id: String,
    worker: String,
    has_attestation: bool,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct JobFailedData {
    job_id: String,
    error: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct JobCancelledData {
    job_id: String,
    cancelled_by: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct WorkerChangedData {
    worker: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct ContractPausedData {
    paused: bool,
}

// ---------------------------------------------------------------------------
// Public emit functions
// ---------------------------------------------------------------------------

pub fn emit_job_submitted(job_id: &str, owner: &AccountId, job_type: &str) {
    emit(
        "job_submitted",
        &JobSubmittedData {
            job_id: job_id.to_string(),
            owner: owner.to_string(),
            job_type: job_type.to_string(),
        },
    );
}

pub fn emit_job_claimed(job_id: &str, worker: &AccountId) {
    emit(
        "job_claimed",
        &JobClaimedData {
            job_id: job_id.to_string(),
            worker: worker.to_string(),
        },
    );
}

pub fn emit_job_checkpointed(job_id: &str, progress: u8, step: &str) {
    emit(
        "job_checkpointed",
        &JobCheckpointedData {
            job_id: job_id.to_string(),
            progress,
            step: step.to_string(),
        },
    );
}

pub fn emit_job_resumed(job_id: &str, worker: &AccountId) {
    emit(
        "job_resumed",
        &JobResumedData {
            job_id: job_id.to_string(),
            worker: worker.to_string(),
        },
    );
}

pub fn emit_job_completed(job_id: &str, worker: &AccountId, has_attestation: bool) {
    emit(
        "job_completed",
        &JobCompletedData {
            job_id: job_id.to_string(),
            worker: worker.to_string(),
            has_attestation,
        },
    );
}

pub fn emit_job_failed(job_id: &str, error: &str) {
    emit(
        "job_failed",
        &JobFailedData {
            job_id: job_id.to_string(),
            error: error.to_string(),
        },
    );
}

pub fn emit_job_cancelled(job_id: &str, cancelled_by: &AccountId) {
    emit(
        "job_cancelled",
        &JobCancelledData {
            job_id: job_id.to_string(),
            cancelled_by: cancelled_by.to_string(),
        },
    );
}

pub fn emit_worker_registered(worker: &AccountId) {
    emit(
        "worker_registered",
        &WorkerChangedData {
            worker: worker.to_string(),
        },
    );
}

pub fn emit_worker_removed(worker: &AccountId) {
    emit(
        "worker_removed",
        &WorkerChangedData {
            worker: worker.to_string(),
        },
    );
}

pub fn emit_contract_paused(paused: bool) {
    emit("contract_paused", &ContractPausedData { paused });
}
