use near_sdk::borsh::{self, BorshSerialize};
use near_sdk::store::{LookupMap, IterableSet};
use near_sdk::{env, AccountId};

use crate::types::{CircuitType, Credential};

/// Storage key prefixes — each must be unique to avoid collisions.
#[derive(BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
pub enum StorageKey {
    VerificationKeys,
    Credentials,
    CredentialsByOwner,
    OwnerCredentials { owner_hash: Vec<u8> },
    Admins,
    RevokedCredentials,
}

/// Generate a unique credential ID from a monotonic nonce.
///
/// Using a nonce instead of `block_height` prevents collisions when multiple
/// credentials are stored in the same block.
pub fn generate_credential_id(owner: &AccountId, circuit_type: &CircuitType, nonce: u64) -> String {
    let hash_input = format!("{owner}:{circuit_type}:{nonce}");
    let hash = env::sha256(hash_input.as_bytes());
    format!("cred-{}", hex::encode(&hash[..16]))
}

/// Store a credential in both the credentials map and the owner's set.
pub fn store_credential(
    credentials: &mut LookupMap<String, Credential>,
    credentials_by_owner: &mut LookupMap<AccountId, IterableSet<String>>,
    credential: Credential,
) {
    let id = credential.id.clone();
    let owner = credential.owner.clone();

    // Store the credential
    credentials.insert(id.clone(), credential);

    // Add to owner's set, creating it if needed
    if credentials_by_owner.get(&owner).is_none() {
        let prefix = StorageKey::OwnerCredentials {
            owner_hash: env::sha256(owner.as_bytes()),
        };
        let new_set = IterableSet::new(borsh::to_vec(&prefix).unwrap());
        credentials_by_owner.insert(owner.clone(), new_set);
    }
    let owner_set = credentials_by_owner.get_mut(&owner).unwrap();
    owner_set.insert(id);
}

/// Get credentials owned by an account with pagination.
///
/// Returns `(credentials, total_matching)` where `total_matching` counts all
/// credentials that pass the expiration filter (not just the returned page).
pub fn get_credentials_by_owner(
    credentials: &LookupMap<String, Credential>,
    credentials_by_owner: &LookupMap<AccountId, IterableSet<String>>,
    owner: &AccountId,
    include_expired: bool,
    offset: u32,
    limit: u32,
) -> (Vec<Credential>, u32) {
    let Some(owner_set) = credentials_by_owner.get(owner) else {
        return (vec![], 0);
    };

    let now = env::block_timestamp() / 1_000_000_000;
    let mut total: u32 = 0;
    let mut result = Vec::new();

    for id in owner_set.iter() {
        if let Some(cred) = credentials.get(id) {
            if include_expired || cred.expires_at > now {
                if total >= offset && (result.len() as u32) < limit {
                    result.push(cred.clone());
                }
                total += 1;
            }
        }
    }

    (result, total)
}

/// Check if a credential exists and is not expired.
pub fn is_credential_valid(
    credentials: &LookupMap<String, Credential>,
    credential_id: &str,
) -> Option<bool> {
    credentials.get(credential_id).map(|cred| {
        let now = env::block_timestamp() / 1_000_000_000;
        cred.expires_at > now
    })
}

/// Remove a credential from storage. Returns true if removed.
pub fn remove_credential(
    credentials: &mut LookupMap<String, Credential>,
    credentials_by_owner: &mut LookupMap<AccountId, IterableSet<String>>,
    credential_id: &str,
    caller: &AccountId,
) -> bool {
    let Some(cred) = credentials.get(credential_id) else {
        return false;
    };

    // Only the owner can remove their credential
    if &cred.owner != caller {
        return false;
    }

    let owner = cred.owner.clone();
    credentials.remove(credential_id);

    // Remove from owner set
    if let Some(owner_set) = credentials_by_owner.get_mut(&owner) {
        owner_set.remove(&credential_id.to_string());
    }

    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn storage_keys_are_distinct() {
        let key1 = borsh::to_vec(&StorageKey::VerificationKeys).unwrap();
        let key2 = borsh::to_vec(&StorageKey::Credentials).unwrap();
        let key3 = borsh::to_vec(&StorageKey::CredentialsByOwner).unwrap();
        assert_ne!(key1, key2);
        assert_ne!(key2, key3);
        assert_ne!(key1, key3);
    }
}
