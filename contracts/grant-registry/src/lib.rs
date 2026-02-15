mod errors;
mod events;
mod storage;
mod types;

use near_sdk::store::{LookupMap, UnorderedMap, UnorderedSet};
use near_sdk::{env, near, AccountId, FunctionError, PanicOnDefault};

use errors::ContractError;
use storage::StorageKey;

pub use types::{
    Application, ApplicationStatus, Category, Chain, EcosystemStats, Program, ProgramStatus,
    Project, TeamMember,
};

/// Global Grant Registry contract for NEAR.
///
/// Manages grant programs, projects, and applications across ecosystems.
/// Provides composable on-chain data that any app can read or contribute to.
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct GrantRegistry {
    /// Contract owner with admin privileges
    owner: AccountId,
    /// Whether the contract is paused
    is_paused: bool,
    /// Grant programs by ID
    programs: UnorderedMap<String, Program>,
    /// Projects by ID
    projects: LookupMap<String, Project>,
    /// Applications by ID
    applications: LookupMap<String, Application>,
    /// Project → application IDs index
    applications_by_project: LookupMap<String, UnorderedSet<String>>,
    /// Program → application IDs index
    applications_by_program: LookupMap<String, UnorderedSet<String>>,
    /// Owner → project IDs index
    projects_by_owner: LookupMap<AccountId, UnorderedSet<String>>,
    /// Running counters
    total_programs: u64,
    total_projects: u64,
    total_applications: u64,
    total_funded: u128,
    active_programs: u64,
}

#[near]
impl GrantRegistry {
    // =========================================================================
    // Initialization
    // =========================================================================

    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            owner,
            is_paused: false,
            programs: UnorderedMap::new(borsh::to_vec(&StorageKey::Programs).unwrap()),
            projects: LookupMap::new(borsh::to_vec(&StorageKey::Projects).unwrap()),
            applications: LookupMap::new(borsh::to_vec(&StorageKey::Applications).unwrap()),
            applications_by_project: LookupMap::new(
                borsh::to_vec(&StorageKey::ApplicationsByProject).unwrap(),
            ),
            applications_by_program: LookupMap::new(
                borsh::to_vec(&StorageKey::ApplicationsByProgram).unwrap(),
            ),
            projects_by_owner: LookupMap::new(
                borsh::to_vec(&StorageKey::ProjectsByOwner).unwrap(),
            ),
            total_programs: 0,
            total_projects: 0,
            total_applications: 0,
            total_funded: 0,
            active_programs: 0,
        }
    }

    // =========================================================================
    // Program management
    // =========================================================================

    /// Register a new grant program.
    pub fn register_program(
        &mut self,
        id: String,
        name: String,
        description: String,
        organization: String,
        chains: Vec<Chain>,
        categories: Vec<Category>,
        funding_pool: String,
        min_amount: Option<String>,
        max_amount: Option<String>,
        deadline: Option<String>,
        website: String,
        application_url: Option<String>,
        status: ProgramStatus,
    ) {
        self.assert_not_paused();
        let caller = env::predecessor_account_id();

        if self.programs.get(&id).is_some() {
            ContractError::ProgramAlreadyExists(id).panic();
        }

        let is_active = status == ProgramStatus::Active;

        let program = Program {
            id: id.clone(),
            name,
            description,
            organization: organization.clone(),
            chains,
            categories,
            funding_pool,
            min_amount,
            max_amount,
            deadline,
            website,
            application_url,
            status,
            registered_by: caller.clone(),
            registered_at: env::block_timestamp(),
            application_count: 0,
            funded_count: 0,
        };

        storage::store_program(&mut self.programs, program);
        self.total_programs += 1;
        if is_active {
            self.active_programs += 1;
        }

        events::emit_program_registered(&id, &organization, &caller);
    }

    /// Search programs with optional filters.
    pub fn search_programs(
        &self,
        category: Option<Category>,
        chain: Option<Chain>,
        status: Option<ProgramStatus>,
        from_index: Option<u32>,
        limit: Option<u32>,
    ) -> Vec<Program> {
        let from = from_index.unwrap_or(0) as usize;
        let lim = limit.unwrap_or(50) as usize;

        self.programs
            .values()
            .filter(|p| {
                if let Some(ref cat) = category {
                    if !p.categories.contains(cat) {
                        return false;
                    }
                }
                if let Some(ref ch) = chain {
                    if !p.chains.contains(ch) {
                        return false;
                    }
                }
                if let Some(ref st) = status {
                    if &p.status != st {
                        return false;
                    }
                }
                true
            })
            .skip(from)
            .take(lim)
            .cloned()
            .collect()
    }

    /// Get a program by ID.
    pub fn get_program(&self, program_id: String) -> Option<Program> {
        self.programs.get(&program_id).cloned()
    }

    // =========================================================================
    // Project management
    // =========================================================================

    /// Register a new project.
    pub fn register_project(
        &mut self,
        id: String,
        name: String,
        description: String,
        website: Option<String>,
        team_members: Vec<TeamMember>,
    ) {
        self.assert_not_paused();
        let caller = env::predecessor_account_id();

        if self.projects.get(&id).is_some() {
            ContractError::ProjectAlreadyExists(id).panic();
        }

        let project = Project {
            id: id.clone(),
            name,
            description,
            website,
            team_members,
            registered_by: caller.clone(),
            registered_at: env::block_timestamp(),
            total_funded: "0".to_string(),
            application_count: 0,
            success_rate: 0,
        };

        storage::store_project(&mut self.projects, &mut self.projects_by_owner, project);
        self.total_projects += 1;

        events::emit_project_registered(&id, &caller);
    }

    /// Get a project by ID.
    pub fn get_project(&self, project_id: String) -> Option<Project> {
        self.projects.get(&project_id).cloned()
    }

    /// Get a project's application history.
    pub fn get_project_history(&self, project_id: String) -> Vec<Application> {
        storage::get_applications_by_project(
            &self.applications,
            &self.applications_by_project,
            &project_id,
        )
    }

    /// Get all projects registered by a specific owner.
    pub fn get_projects_by_owner(&self, owner: AccountId) -> Vec<Project> {
        storage::get_projects_by_owner(&self.projects, &self.projects_by_owner, &owner)
    }

    // =========================================================================
    // Application management
    // =========================================================================

    /// Record a new grant application.
    pub fn record_application(
        &mut self,
        id: String,
        program_id: String,
        project_id: String,
        title: String,
        requested_amount: String,
    ) {
        self.assert_not_paused();
        let caller = env::predecessor_account_id();

        if self.applications.get(&id).is_some() {
            ContractError::ApplicationAlreadyExists(id).panic();
        }

        // Verify program exists
        let program = self.programs.get(&program_id).unwrap_or_else(|| {
            ContractError::ProgramNotFound(program_id.clone()).panic()
        });

        // Verify project exists
        if self.projects.get(&project_id).is_none() {
            ContractError::ProjectNotFound(project_id.clone()).panic();
        }

        let now = env::block_timestamp();

        let application = Application {
            id: id.clone(),
            program_id: program_id.clone(),
            project_id: project_id.clone(),
            applicant_account_id: caller.clone(),
            title,
            requested_amount,
            status: ApplicationStatus::Submitted,
            submitted_at: Some(now),
            funded_amount: None,
            completed_at: None,
        };

        storage::store_application(
            &mut self.applications,
            &mut self.applications_by_project,
            &mut self.applications_by_program,
            application,
        );

        // Update program application count
        if let Some(p) = self.programs.get_mut(&program_id) {
            p.application_count += 1;
        }

        // Update project application count
        if let Some(proj) = self.projects.get_mut(&project_id) {
            proj.application_count += 1;
        }

        self.total_applications += 1;

        events::emit_application_recorded(&id, &program_id, &project_id, &caller);
    }

    /// Update an application's status.
    pub fn update_application(
        &mut self,
        application_id: String,
        new_status: ApplicationStatus,
        funded_amount: Option<String>,
    ) {
        self.assert_not_paused();
        let caller = env::predecessor_account_id();

        let app = self
            .applications
            .get_mut(&application_id)
            .unwrap_or_else(|| {
                ContractError::ApplicationNotFound(application_id.clone()).panic()
            });

        let was_funded = app.status == ApplicationStatus::Funded;

        app.status = new_status.clone();

        if let Some(ref amount) = funded_amount {
            app.funded_amount = Some(amount.clone());
        }

        if new_status == ApplicationStatus::Completed {
            app.completed_at = Some(env::block_timestamp());
        }

        // Track funded count on program
        if new_status == ApplicationStatus::Funded && !was_funded {
            if let Some(p) = self.programs.get_mut(&app.program_id) {
                p.funded_count += 1;
            }
            // Track total funded
            if let Some(ref amount) = funded_amount {
                if let Ok(num) = amount.parse::<u128>() {
                    self.total_funded += num;
                }
            }
        }

        let status_str = serde_json::to_string(&new_status).unwrap_or_default();
        events::emit_application_updated(&application_id, &status_str, &caller);
    }

    // =========================================================================
    // Stats
    // =========================================================================

    /// Get ecosystem-wide statistics.
    pub fn get_ecosystem_stats(&self) -> EcosystemStats {
        EcosystemStats {
            total_programs: self.total_programs,
            total_projects: self.total_projects,
            total_funded: self.total_funded.to_string(),
            total_applications: self.total_applications,
            active_programs: self.active_programs,
        }
    }

    // =========================================================================
    // Admin
    // =========================================================================

    /// Pause or unpause the contract.
    pub fn set_paused(&mut self, paused: bool) {
        self.assert_owner();
        self.is_paused = paused;
        events::emit_contract_paused(paused);
    }

    // =========================================================================
    // Internal helpers
    // =========================================================================

    fn assert_owner(&self) {
        if env::predecessor_account_id() != self.owner {
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

    fn owner() -> AccountId {
        "owner.testnet".parse().unwrap()
    }

    fn alice() -> AccountId {
        "alice.testnet".parse().unwrap()
    }

    fn bob() -> AccountId {
        "bob.testnet".parse().unwrap()
    }

    fn setup_context(predecessor: &AccountId) {
        let context = VMContextBuilder::new()
            .predecessor_account_id(predecessor.clone())
            .block_timestamp(1_700_000_000 * 1_000_000_000)
            .build();
        testing_env!(context);
    }

    fn init_contract() -> GrantRegistry {
        setup_context(&owner());
        GrantRegistry::new(owner())
    }

    fn register_test_program(contract: &mut GrantRegistry) -> String {
        setup_context(&alice());
        let program_id = "gitcoin-gg20".to_string();
        contract.register_program(
            program_id.clone(),
            "Gitcoin GG20".into(),
            "Gitcoin Grants Round 20".into(),
            "Gitcoin".into(),
            vec![Chain::Ethereum, Chain::Near],
            vec![Category::PublicGoods, Category::Infrastructure],
            "1000000".into(),
            Some("1000".into()),
            Some("50000".into()),
            Some("2025-12-31T23:59:59Z".into()),
            "https://gitcoin.co".into(),
            Some("https://gitcoin.co/apply".into()),
            ProgramStatus::Active,
        );
        program_id
    }

    fn register_test_project(contract: &mut GrantRegistry) -> String {
        setup_context(&alice());
        let project_id = "shade-studio".to_string();
        contract.register_project(
            project_id.clone(),
            "Shade Studio".into(),
            "Privacy-first DAO governance toolkit".into(),
            Some("https://shade.studio".into()),
            vec![TeamMember {
                account_id: "alice.testnet".into(),
                name: "Alice".into(),
                role: "Lead Developer".into(),
                profile_url: None,
            }],
        );
        project_id
    }

    #[test]
    fn test_init() {
        let contract = init_contract();
        assert_eq!(contract.owner, owner());
        assert!(!contract.is_paused);

        let stats = contract.get_ecosystem_stats();
        assert_eq!(stats.total_programs, 0);
        assert_eq!(stats.total_projects, 0);
        assert_eq!(stats.total_applications, 0);
    }

    #[test]
    fn test_register_program() {
        let mut contract = init_contract();
        let program_id = register_test_program(&mut contract);

        let program = contract.get_program(program_id).unwrap();
        assert_eq!(program.name, "Gitcoin GG20");
        assert_eq!(program.organization, "Gitcoin");
        assert_eq!(program.chains.len(), 2);
        assert_eq!(program.categories.len(), 2);
        assert_eq!(contract.get_ecosystem_stats().total_programs, 1);
        assert_eq!(contract.get_ecosystem_stats().active_programs, 1);
    }

    #[test]
    #[should_panic(expected = "Program already exists")]
    fn test_duplicate_program() {
        let mut contract = init_contract();
        register_test_program(&mut contract);
        register_test_program(&mut contract);
    }

    #[test]
    fn test_search_programs() {
        let mut contract = init_contract();
        register_test_program(&mut contract);

        // No filters
        let results = contract.search_programs(None, None, None, None, None);
        assert_eq!(results.len(), 1);

        // Filter by category
        let results = contract.search_programs(
            Some(Category::PublicGoods),
            None,
            None,
            None,
            None,
        );
        assert_eq!(results.len(), 1);

        // Filter by non-matching category
        let results = contract.search_programs(Some(Category::Gaming), None, None, None, None);
        assert_eq!(results.len(), 0);

        // Filter by chain
        let results = contract.search_programs(None, Some(Chain::Near), None, None, None);
        assert_eq!(results.len(), 1);

        // Filter by status
        let results = contract.search_programs(
            None,
            None,
            Some(ProgramStatus::Active),
            None,
            None,
        );
        assert_eq!(results.len(), 1);

        let results = contract.search_programs(
            None,
            None,
            Some(ProgramStatus::Closed),
            None,
            None,
        );
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn test_register_project() {
        let mut contract = init_contract();
        let project_id = register_test_project(&mut contract);

        let project = contract.get_project(project_id).unwrap();
        assert_eq!(project.name, "Shade Studio");
        assert_eq!(project.team_members.len(), 1);
        assert_eq!(contract.get_ecosystem_stats().total_projects, 1);
    }

    #[test]
    #[should_panic(expected = "Project already exists")]
    fn test_duplicate_project() {
        let mut contract = init_contract();
        register_test_project(&mut contract);
        register_test_project(&mut contract);
    }

    #[test]
    fn test_record_application() {
        let mut contract = init_contract();
        let program_id = register_test_program(&mut contract);
        let project_id = register_test_project(&mut contract);

        setup_context(&alice());
        contract.record_application(
            "app-1".into(),
            program_id.clone(),
            project_id.clone(),
            "Privacy Dashboard Grant".into(),
            "25000".into(),
        );

        let stats = contract.get_ecosystem_stats();
        assert_eq!(stats.total_applications, 1);

        let program = contract.get_program(program_id).unwrap();
        assert_eq!(program.application_count, 1);

        let project = contract.get_project(project_id.clone()).unwrap();
        assert_eq!(project.application_count, 1);

        let history = contract.get_project_history(project_id);
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].title, "Privacy Dashboard Grant");
    }

    #[test]
    fn test_update_application() {
        let mut contract = init_contract();
        let program_id = register_test_program(&mut contract);
        let project_id = register_test_project(&mut contract);

        setup_context(&alice());
        contract.record_application(
            "app-1".into(),
            program_id.clone(),
            project_id,
            "Grant Proposal".into(),
            "10000".into(),
        );

        contract.update_application(
            "app-1".into(),
            ApplicationStatus::Funded,
            Some("10000".into()),
        );

        let program = contract.get_program(program_id).unwrap();
        assert_eq!(program.funded_count, 1);
    }

    #[test]
    #[should_panic(expected = "Program not found")]
    fn test_application_nonexistent_program() {
        let mut contract = init_contract();
        let project_id = register_test_project(&mut contract);

        setup_context(&alice());
        contract.record_application(
            "app-1".into(),
            "nonexistent".into(),
            project_id,
            "Test".into(),
            "1000".into(),
        );
    }

    #[test]
    fn test_pause_blocks_operations() {
        let mut contract = init_contract();

        setup_context(&owner());
        contract.set_paused(true);

        setup_context(&alice());
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            contract.register_program(
                "test".into(),
                "Test".into(),
                "Test".into(),
                "Org".into(),
                vec![],
                vec![],
                "0".into(),
                None,
                None,
                None,
                "https://example.com".into(),
                None,
                ProgramStatus::Active,
            );
        }));
        assert!(result.is_err());
    }

    #[test]
    fn test_get_projects_by_owner() {
        let mut contract = init_contract();

        // Alice registers 2 projects
        setup_context(&alice());
        contract.register_project(
            "proj-a1".into(),
            "Alice Project 1".into(),
            "First project by Alice".into(),
            None,
            vec![TeamMember {
                account_id: "alice.testnet".into(),
                name: "Alice".into(),
                role: "Lead".into(),
                profile_url: None,
            }],
        );
        contract.register_project(
            "proj-a2".into(),
            "Alice Project 2".into(),
            "Second project by Alice".into(),
            None,
            vec![TeamMember {
                account_id: "alice.testnet".into(),
                name: "Alice".into(),
                role: "Lead".into(),
                profile_url: None,
            }],
        );

        // Bob registers 1 project
        setup_context(&bob());
        contract.register_project(
            "proj-b1".into(),
            "Bob Project 1".into(),
            "First project by Bob".into(),
            None,
            vec![TeamMember {
                account_id: "bob.testnet".into(),
                name: "Bob".into(),
                role: "Lead".into(),
                profile_url: None,
            }],
        );

        // Alice sees only her 2 projects
        let alice_projects = contract.get_projects_by_owner(alice());
        assert_eq!(alice_projects.len(), 2);
        let alice_ids: Vec<&str> = alice_projects.iter().map(|p| p.id.as_str()).collect();
        assert!(alice_ids.contains(&"proj-a1"));
        assert!(alice_ids.contains(&"proj-a2"));

        // Bob sees only his 1 project
        let bob_projects = contract.get_projects_by_owner(bob());
        assert_eq!(bob_projects.len(), 1);
        assert_eq!(bob_projects[0].id, "proj-b1");

        // Unknown owner gets empty
        let unknown: AccountId = "unknown.testnet".parse().unwrap();
        let empty = contract.get_projects_by_owner(unknown);
        assert_eq!(empty.len(), 0);

        // Total count is still correct
        assert_eq!(contract.get_ecosystem_stats().total_projects, 3);
    }
}
