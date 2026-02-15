use near_sdk::borsh::{self, BorshSerialize};
use near_sdk::store::{IterableSet, LookupMap};
use near_sdk::{env, AccountId};

use crate::types::Job;

/// Storage key prefixes — each must be unique to avoid collisions.
#[derive(BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
pub enum StorageKey {
    Jobs,
    JobsByOwner,
    OwnerJobs { owner_hash: Vec<u8> },
    PendingJobs,
    Workers,
}

/// Generate a unique job ID from a monotonic nonce.
pub fn generate_job_id(owner: &AccountId, nonce: u64) -> String {
    let hash_input = format!("{owner}:job:{nonce}");
    let hash = env::sha256(hash_input.as_bytes());
    format!("job-{}", hex::encode(&hash[..16]))
}

/// Store a job in both the jobs map and the owner's set.
pub fn store_job(
    jobs: &mut LookupMap<String, Job>,
    jobs_by_owner: &mut LookupMap<AccountId, IterableSet<String>>,
    job: Job,
) {
    let id = job.id.clone();
    let owner = job.owner.clone();

    jobs.insert(id.clone(), job);

    if jobs_by_owner.get(&owner).is_none() {
        let prefix = StorageKey::OwnerJobs {
            owner_hash: env::sha256(owner.as_bytes()),
        };
        let new_set = IterableSet::new(borsh::to_vec(&prefix).unwrap());
        jobs_by_owner.insert(owner.clone(), new_set);
    }
    let owner_set = jobs_by_owner.get_mut(&owner).unwrap();
    owner_set.insert(id);
}

/// Get jobs owned by an account with pagination.
pub fn get_jobs_by_owner(
    jobs: &LookupMap<String, Job>,
    jobs_by_owner: &LookupMap<AccountId, IterableSet<String>>,
    owner: &AccountId,
    include_completed: bool,
    offset: u32,
    limit: u32,
) -> (Vec<Job>, u32) {
    let Some(owner_set) = jobs_by_owner.get(owner) else {
        return (vec![], 0);
    };

    let mut total: u32 = 0;
    let mut result = Vec::new();

    for id in owner_set.iter() {
        if let Some(job) = jobs.get(id) {
            if include_completed || !job.status.is_terminal() {
                if total >= offset && (result.len() as u32) < limit {
                    result.push(job.clone());
                }
                total += 1;
            }
        }
    }

    (result, total)
}

/// Count active (non-terminal) jobs for an owner.
pub fn count_active_jobs(
    jobs: &LookupMap<String, Job>,
    jobs_by_owner: &LookupMap<AccountId, IterableSet<String>>,
    owner: &AccountId,
) -> u32 {
    let Some(owner_set) = jobs_by_owner.get(owner) else {
        return 0;
    };

    let mut count: u32 = 0;
    for id in owner_set.iter() {
        if let Some(job) = jobs.get(id) {
            if !job.status.is_terminal() {
                count += 1;
            }
        }
    }
    count
}

/// Remove a job from storage (for cancellation). Returns true if removed.
pub fn remove_job(
    jobs: &mut LookupMap<String, Job>,
    jobs_by_owner: &mut LookupMap<AccountId, IterableSet<String>>,
    pending_jobs: &mut IterableSet<String>,
    job_id: &str,
    caller: &AccountId,
) -> bool {
    let Some(job) = jobs.get(job_id) else {
        return false;
    };

    // Only the owner can cancel their job
    if &job.owner != caller {
        return false;
    }

    let owner = job.owner.clone();
    jobs.remove(job_id);
    pending_jobs.remove(job_id);

    if let Some(owner_set) = jobs_by_owner.get_mut(&owner) {
        owner_set.remove(&job_id.to_string());
    }

    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn storage_keys_are_distinct() {
        let key1 = borsh::to_vec(&StorageKey::Jobs).unwrap();
        let key2 = borsh::to_vec(&StorageKey::JobsByOwner).unwrap();
        let key3 = borsh::to_vec(&StorageKey::PendingJobs).unwrap();
        let key4 = borsh::to_vec(&StorageKey::Workers).unwrap();
        assert_ne!(key1, key2);
        assert_ne!(key2, key3);
        assert_ne!(key3, key4);
        assert_ne!(key1, key3);
    }
}
