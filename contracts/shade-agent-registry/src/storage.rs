use near_sdk::borsh::{self, BorshSerialize};
use near_sdk::store::{LookupMap, UnorderedMap, UnorderedSet};
use near_sdk::AccountId;

use crate::types::{Instance, Template};

/// Storage key prefixes — each must be unique to avoid collisions.
#[derive(BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
pub enum StorageKey {
    Templates,
    Instances,
    InstancesByOwner,
    OwnerInstances { owner_hash: Vec<u8> },
    VerifiedCodehashes,
}

/// Store a template in the registry.
pub fn store_template(
    templates: &mut UnorderedMap<String, Template>,
    template: Template,
) {
    templates.insert(template.id.clone(), template);
}

/// Store an agent instance.
pub fn store_instance(
    instances: &mut LookupMap<AccountId, Instance>,
    instances_by_owner: &mut LookupMap<AccountId, UnorderedSet<AccountId>>,
    instance: Instance,
) {
    let account_id = instance.account_id.clone();
    let owner = instance.owner_account_id.clone();

    instances.insert(account_id.clone(), instance);

    if instances_by_owner.get(&owner).is_none() {
        let prefix = StorageKey::OwnerInstances {
            owner_hash: near_sdk::env::sha256(owner.as_bytes()),
        };
        let new_set = UnorderedSet::new(borsh::to_vec(&prefix).unwrap());
        instances_by_owner.insert(owner.clone(), new_set);
    }
    let owner_set = instances_by_owner.get_mut(&owner).unwrap();
    owner_set.insert(account_id);
}

/// Get all instances owned by an account.
pub fn get_instances_by_owner(
    instances: &LookupMap<AccountId, Instance>,
    instances_by_owner: &LookupMap<AccountId, UnorderedSet<AccountId>>,
    owner: &AccountId,
) -> Vec<Instance> {
    let Some(owner_set) = instances_by_owner.get(owner) else {
        return vec![];
    };

    let mut result = Vec::new();
    for account_id in owner_set.iter() {
        if let Some(instance) = instances.get(account_id) {
            result.push(instance.clone());
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn storage_keys_are_distinct() {
        let key1 = borsh::to_vec(&StorageKey::Templates).unwrap();
        let key2 = borsh::to_vec(&StorageKey::Instances).unwrap();
        let key3 = borsh::to_vec(&StorageKey::InstancesByOwner).unwrap();
        let key4 = borsh::to_vec(&StorageKey::VerifiedCodehashes).unwrap();
        assert_ne!(key1, key2);
        assert_ne!(key2, key3);
        assert_ne!(key3, key4);
        assert_ne!(key1, key3);
    }
}
