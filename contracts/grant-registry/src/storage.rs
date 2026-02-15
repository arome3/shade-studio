use near_sdk::borsh::{self, BorshSerialize};
use near_sdk::store::{LookupMap, UnorderedMap, UnorderedSet};
use near_sdk::AccountId;

use crate::types::{Application, Program, Project};

/// Storage key prefixes — each must be unique to avoid collisions.
#[derive(BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
pub enum StorageKey {
    Programs,
    Projects,
    Applications,
    ApplicationsByProject,
    ProjectApplications { project_hash: Vec<u8> },
    ApplicationsByProgram,
    ProgramApplications { program_hash: Vec<u8> },
    ProjectsByOwner,
    OwnerProjects { owner_hash: Vec<u8> },
}

/// Store a program in the registry.
pub fn store_program(
    programs: &mut UnorderedMap<String, Program>,
    program: Program,
) {
    programs.insert(program.id.clone(), program);
}

/// Store a project and update the owner index.
pub fn store_project(
    projects: &mut LookupMap<String, Project>,
    projects_by_owner: &mut LookupMap<AccountId, UnorderedSet<String>>,
    project: Project,
) {
    let project_id = project.id.clone();
    let owner = project.registered_by.clone();

    // Populate owner index before main insert for clarity of intent
    if projects_by_owner.get(&owner).is_none() {
        let prefix = StorageKey::OwnerProjects {
            owner_hash: near_sdk::env::sha256(owner.as_bytes()),
        };
        let new_set = UnorderedSet::new(borsh::to_vec(&prefix).unwrap());
        projects_by_owner.insert(owner.clone(), new_set);
    }
    let owner_set = projects_by_owner.get_mut(&owner).unwrap();
    owner_set.insert(project_id.clone());

    projects.insert(project_id, project);
}

/// Get all projects owned by an account.
pub fn get_projects_by_owner(
    projects: &LookupMap<String, Project>,
    projects_by_owner: &LookupMap<AccountId, UnorderedSet<String>>,
    owner: &AccountId,
) -> Vec<Project> {
    let Some(owner_set) = projects_by_owner.get(owner) else {
        return vec![];
    };

    let mut result = Vec::new();
    for project_id in owner_set.iter() {
        if let Some(project) = projects.get(project_id) {
            result.push(project.clone());
        }
    }
    result
}

/// Store an application and update indexes.
pub fn store_application(
    applications: &mut LookupMap<String, Application>,
    apps_by_project: &mut LookupMap<String, UnorderedSet<String>>,
    apps_by_program: &mut LookupMap<String, UnorderedSet<String>>,
    application: Application,
) {
    let app_id = application.id.clone();
    let project_id = application.project_id.clone();
    let program_id = application.program_id.clone();

    applications.insert(app_id.clone(), application);

    // Update project → applications index
    if apps_by_project.get(&project_id).is_none() {
        let prefix = StorageKey::ProjectApplications {
            project_hash: near_sdk::env::sha256(project_id.as_bytes()),
        };
        let new_set = UnorderedSet::new(borsh::to_vec(&prefix).unwrap());
        apps_by_project.insert(project_id.clone(), new_set);
    }
    let project_set = apps_by_project.get_mut(&project_id).unwrap();
    project_set.insert(app_id.clone());

    // Update program → applications index
    if apps_by_program.get(&program_id).is_none() {
        let prefix = StorageKey::ProgramApplications {
            program_hash: near_sdk::env::sha256(program_id.as_bytes()),
        };
        let new_set = UnorderedSet::new(borsh::to_vec(&prefix).unwrap());
        apps_by_program.insert(program_id.clone(), new_set);
    }
    let program_set = apps_by_program.get_mut(&program_id).unwrap();
    program_set.insert(app_id);
}

/// Get all applications for a project.
pub fn get_applications_by_project(
    applications: &LookupMap<String, Application>,
    apps_by_project: &LookupMap<String, UnorderedSet<String>>,
    project_id: &str,
) -> Vec<Application> {
    let Some(app_set) = apps_by_project.get(project_id) else {
        return vec![];
    };

    let mut result = Vec::new();
    for app_id in app_set.iter() {
        if let Some(app) = applications.get(app_id) {
            result.push(app.clone());
        }
    }
    result
}

/// Get all applications for a program.
pub fn get_applications_by_program(
    applications: &LookupMap<String, Application>,
    apps_by_program: &LookupMap<String, UnorderedSet<String>>,
    program_id: &str,
) -> Vec<Application> {
    let Some(app_set) = apps_by_program.get(program_id) else {
        return vec![];
    };

    let mut result = Vec::new();
    for app_id in app_set.iter() {
        if let Some(app) = applications.get(app_id) {
            result.push(app.clone());
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn storage_keys_are_distinct() {
        let key1 = borsh::to_vec(&StorageKey::Programs).unwrap();
        let key2 = borsh::to_vec(&StorageKey::Projects).unwrap();
        let key3 = borsh::to_vec(&StorageKey::Applications).unwrap();
        let key4 = borsh::to_vec(&StorageKey::ApplicationsByProject).unwrap();
        let key5 = borsh::to_vec(&StorageKey::ApplicationsByProgram).unwrap();
        let key6 = borsh::to_vec(&StorageKey::ProjectsByOwner).unwrap();
        assert_ne!(key1, key2);
        assert_ne!(key2, key3);
        assert_ne!(key3, key4);
        assert_ne!(key4, key5);
        assert_ne!(key5, key6);
        assert_ne!(key1, key6);
    }
}
