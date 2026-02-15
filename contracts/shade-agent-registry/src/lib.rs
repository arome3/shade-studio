mod errors;
mod events;
mod storage;
mod types;

use near_sdk::store::{LookupMap, UnorderedMap, UnorderedSet};
use near_sdk::{env, near, AccountId, FunctionError, PanicOnDefault};

use errors::ContractError;
use storage::StorageKey;

pub use types::{
    AgentStatus, Attestation, Capability, Instance, Permission, Stats, Template,
    VerificationResult,
};

/// Shade Agent Registry contract for NEAR.
///
/// Manages agent templates, deployed instances, codehash verification,
/// and TEE attestation recording. Provides the on-chain backbone for
/// the Shade Agent lifecycle.
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct ShadeAgentRegistry {
    /// Contract owner with admin privileges
    owner: AccountId,
    /// Whether the contract is paused
    is_paused: bool,
    /// Agent templates by ID
    templates: UnorderedMap<String, Template>,
    /// Agent instances by account ID
    instances: LookupMap<AccountId, Instance>,
    /// Instance account IDs grouped by owner
    instances_by_owner: LookupMap<AccountId, UnorderedSet<AccountId>>,
    /// Set of verified codehashes
    verified_codehashes: UnorderedSet<String>,
    /// Total templates registered
    total_templates: u64,
    /// Total instances deployed
    total_deployments: u64,
}

#[near]
impl ShadeAgentRegistry {
    // =========================================================================
    // Initialization
    // =========================================================================

    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            owner,
            is_paused: false,
            templates: UnorderedMap::new(borsh::to_vec(&StorageKey::Templates).unwrap()),
            instances: LookupMap::new(borsh::to_vec(&StorageKey::Instances).unwrap()),
            instances_by_owner: LookupMap::new(
                borsh::to_vec(&StorageKey::InstancesByOwner).unwrap(),
            ),
            verified_codehashes: UnorderedSet::new(
                borsh::to_vec(&StorageKey::VerifiedCodehashes).unwrap(),
            ),
            total_templates: 0,
            total_deployments: 0,
        }
    }

    // =========================================================================
    // Template management
    // =========================================================================

    /// Register a new agent template.
    pub fn register_template(
        &mut self,
        id: String,
        name: String,
        description: String,
        version: String,
        codehash: String,
        source_url: String,
        audit_url: Option<String>,
        capabilities: Vec<Capability>,
        required_permissions: Vec<Permission>,
    ) {
        self.assert_not_paused();
        let caller = env::predecessor_account_id();

        if self.templates.get(&id).is_some() {
            ContractError::TemplateAlreadyExists(id).panic();
        }

        let template = Template {
            id: id.clone(),
            name,
            description,
            version,
            codehash: codehash.clone(),
            source_url,
            audit_url,
            creator: caller.clone(),
            capabilities,
            required_permissions,
            created_at: env::block_timestamp(),
            deployments: 0,
            is_audited: false,
        };

        storage::store_template(&mut self.templates, template);
        self.total_templates += 1;

        events::emit_template_registered(&id, &caller, &codehash);
    }

    /// List templates with pagination.
    pub fn list_templates(&self, from_index: Option<u32>, limit: Option<u32>) -> Vec<Template> {
        let from = from_index.unwrap_or(0) as usize;
        let lim = limit.unwrap_or(50) as usize;

        self.templates
            .values()
            .skip(from)
            .take(lim)
            .cloned()
            .collect()
    }

    /// Get a template by ID.
    pub fn get_template(&self, template_id: String) -> Option<Template> {
        self.templates.get(&template_id).cloned()
    }

    // =========================================================================
    // Instance management
    // =========================================================================

    /// Register a deployed agent instance.
    pub fn register_instance(
        &mut self,
        agent_account_id: AccountId,
        owner_account_id: AccountId,
        template_id: String,
        codehash: String,
        name: String,
        capabilities: Vec<Capability>,
    ) {
        self.assert_not_paused();
        let caller = env::predecessor_account_id();

        // Only the owner can register their agent
        if caller != owner_account_id {
            ContractError::Unauthorized.panic();
        }

        if self.instances.get(&agent_account_id).is_some() {
            ContractError::InstanceAlreadyRegistered(agent_account_id.to_string()).panic();
        }

        // Verify template exists
        let template = self.templates.get(&template_id).unwrap_or_else(|| {
            ContractError::TemplateNotFound(template_id.clone()).panic()
        });

        // Verify codehash matches
        if template.codehash != codehash {
            ContractError::CodehashMismatch {
                expected: template.codehash.clone(),
                actual: codehash,
            }
            .panic();
        }

        let now = env::block_timestamp();
        let instance = Instance {
            account_id: agent_account_id.clone(),
            owner_account_id: owner_account_id.clone(),
            template_id: template_id.clone(),
            codehash: template.codehash.clone(),
            name,
            status: AgentStatus::Active,
            last_active_at: None,
            deployed_at: now,
            last_attestation: None,
            invocation_count: 0,
            capabilities,
        };

        storage::store_instance(
            &mut self.instances,
            &mut self.instances_by_owner,
            instance,
        );

        // Increment template deployment count
        if let Some(t) = self.templates.get_mut(&template_id) {
            t.deployments += 1;
        }

        self.total_deployments += 1;

        events::emit_instance_registered(&agent_account_id, &owner_account_id, &template_id);
    }

    /// Deactivate an agent instance. Only the owner can deactivate.
    pub fn deactivate_instance(&mut self, agent_account_id: AccountId) {
        self.assert_not_paused();
        let caller = env::predecessor_account_id();

        let instance = self.instances.get_mut(&agent_account_id).unwrap_or_else(|| {
            ContractError::InstanceNotFound(agent_account_id.to_string()).panic()
        });

        if instance.owner_account_id != caller {
            ContractError::Unauthorized.panic();
        }

        instance.status = AgentStatus::Deactivated;

        events::emit_instance_deactivated(&agent_account_id, &caller);
    }

    /// Get an agent instance by account ID.
    pub fn get_instance(&self, agent_account_id: AccountId) -> Option<Instance> {
        self.instances.get(&agent_account_id).cloned()
    }

    /// Get all instances owned by an account.
    pub fn get_instances_by_owner(&self, owner_account_id: AccountId) -> Vec<Instance> {
        storage::get_instances_by_owner(
            &self.instances,
            &self.instances_by_owner,
            &owner_account_id,
        )
    }

    // =========================================================================
    // Verification
    // =========================================================================

    /// Verify an agent instance's codehash against the registry.
    pub fn verify_instance(&self, agent_account_id: AccountId) -> VerificationResult {
        let instance = match self.instances.get(&agent_account_id) {
            Some(i) => i,
            None => {
                return VerificationResult {
                    valid: false,
                    reason: Some(format!("Instance not found: {agent_account_id}")),
                    is_audited: false,
                    attestation: None,
                };
            }
        };

        let template = match self.templates.get(&instance.template_id) {
            Some(t) => t,
            None => {
                return VerificationResult {
                    valid: false,
                    reason: Some(format!(
                        "Template not found: {}",
                        instance.template_id
                    )),
                    is_audited: false,
                    attestation: None,
                };
            }
        };

        if instance.codehash != template.codehash {
            return VerificationResult {
                valid: false,
                reason: Some(format!(
                    "Codehash mismatch: instance has {}, template has {}",
                    instance.codehash, template.codehash
                )),
                is_audited: template.is_audited,
                attestation: instance.last_attestation.clone(),
            };
        }

        VerificationResult {
            valid: true,
            reason: None,
            is_audited: template.is_audited,
            attestation: instance.last_attestation.clone(),
        }
    }

    /// Check if a codehash is in the verified set.
    pub fn is_codehash_verified(&self, codehash: String) -> bool {
        self.verified_codehashes.contains(&codehash)
    }

    /// Verify and add a codehash to the verified set (admin only).
    pub fn verify_codehash(&mut self, codehash: String) {
        self.assert_owner();
        self.verified_codehashes.insert(codehash);
    }

    // =========================================================================
    // Attestation
    // =========================================================================

    /// Record a TEE attestation for an agent instance.
    pub fn record_attestation(
        &mut self,
        agent_account_id: AccountId,
        attestation: Attestation,
    ) {
        self.assert_not_paused();

        let instance = self.instances.get_mut(&agent_account_id).unwrap_or_else(|| {
            ContractError::InstanceNotFound(agent_account_id.to_string()).panic()
        });

        events::emit_attestation_recorded(
            &agent_account_id,
            &attestation.tee_type,
            &attestation.codehash,
        );

        instance.last_attestation = Some(attestation);
    }

    /// Record an invocation for an agent instance.
    /// Increments invocation_count and updates last_active_at.
    /// Only the owner or the agent itself can record invocations.
    pub fn record_invocation(
        &mut self,
        agent_account_id: AccountId,
        invocation_type: String,
    ) -> u64 {
        self.assert_not_paused();

        let instance = self.instances.get_mut(&agent_account_id).unwrap_or_else(|| {
            ContractError::InstanceNotFound(agent_account_id.to_string()).panic()
        });

        let caller = env::predecessor_account_id();
        if caller != instance.owner_account_id && caller != agent_account_id {
            ContractError::Unauthorized.panic();
        }

        instance.invocation_count += 1;
        instance.last_active_at = Some(env::block_timestamp());

        events::emit_invocation_recorded(
            &agent_account_id,
            &invocation_type,
            instance.invocation_count,
        );

        instance.invocation_count
    }

    // =========================================================================
    // Stats
    // =========================================================================

    /// Get registry statistics.
    pub fn get_stats(&self) -> Stats {
        Stats {
            total_templates: self.total_templates,
            total_deployments: self.total_deployments,
            verified_codehashes: self.verified_codehashes.len() as u64,
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

    /// Mark a template as audited (admin only).
    pub fn mark_audited(&mut self, template_id: String) {
        self.assert_owner();

        let template = self.templates.get_mut(&template_id).unwrap_or_else(|| {
            ContractError::TemplateNotFound(template_id.clone()).panic()
        });

        template.is_audited = true;

        // Add codehash to verified set
        let codehash = template.codehash.clone();
        self.verified_codehashes.insert(codehash);

        events::emit_template_audited(&template_id);
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

    fn agent_account() -> AccountId {
        "my-agent.alice.testnet".parse().unwrap()
    }

    fn setup_context(predecessor: &AccountId) {
        let context = VMContextBuilder::new()
            .predecessor_account_id(predecessor.clone())
            .block_timestamp(1_700_000_000 * 1_000_000_000)
            .build();
        testing_env!(context);
    }

    fn init_contract() -> ShadeAgentRegistry {
        setup_context(&owner());
        ShadeAgentRegistry::new(owner())
    }

    fn register_test_template(contract: &mut ShadeAgentRegistry) -> String {
        setup_context(&alice());
        let template_id = "tmpl-analysis-v1".to_string();
        contract.register_template(
            template_id.clone(),
            "Analysis Agent".into(),
            "Performs document analysis".into(),
            "1.0.0".into(),
            "abc123hash".into(),
            "https://github.com/example/agent".into(),
            None,
            vec![Capability::AiAnalysis, Capability::ReadDocuments],
            vec![Permission {
                receiver_id: "social.testnet".into(),
                method_names: vec!["get".into()],
                allowance: "250000000000000000000000".into(),
                purpose: "Read social data".into(),
            }],
        );
        template_id
    }

    #[test]
    fn test_init() {
        let contract = init_contract();
        assert_eq!(contract.owner, owner());
        assert!(!contract.is_paused);

        let stats = contract.get_stats();
        assert_eq!(stats.total_templates, 0);
        assert_eq!(stats.total_deployments, 0);
        assert_eq!(stats.verified_codehashes, 0);
    }

    #[test]
    fn test_register_template() {
        let mut contract = init_contract();
        let template_id = register_test_template(&mut contract);

        let template = contract.get_template(template_id).unwrap();
        assert_eq!(template.name, "Analysis Agent");
        assert_eq!(template.codehash, "abc123hash");
        assert_eq!(template.capabilities.len(), 2);
        assert_eq!(contract.get_stats().total_templates, 1);
    }

    #[test]
    fn test_list_templates() {
        let mut contract = init_contract();
        register_test_template(&mut contract);

        let templates = contract.list_templates(None, None);
        assert_eq!(templates.len(), 1);
    }

    #[test]
    #[should_panic(expected = "Template already exists")]
    fn test_duplicate_template() {
        let mut contract = init_contract();
        register_test_template(&mut contract);
        register_test_template(&mut contract);
    }

    #[test]
    fn test_register_instance() {
        let mut contract = init_contract();
        let template_id = register_test_template(&mut contract);

        setup_context(&alice());
        contract.register_instance(
            agent_account(),
            alice(),
            template_id,
            "abc123hash".into(),
            "My Analysis Agent".into(),
            vec![Capability::AiAnalysis],
        );

        let instance = contract.get_instance(agent_account()).unwrap();
        assert_eq!(instance.name, "My Analysis Agent");
        assert_eq!(instance.status, AgentStatus::Active);
        assert_eq!(contract.get_stats().total_deployments, 1);

        // Check template deployment count incremented
        let template = contract.get_template("tmpl-analysis-v1".into()).unwrap();
        assert_eq!(template.deployments, 1);
    }

    #[test]
    #[should_panic(expected = "Codehash mismatch")]
    fn test_register_instance_wrong_codehash() {
        let mut contract = init_contract();
        let template_id = register_test_template(&mut contract);

        setup_context(&alice());
        contract.register_instance(
            agent_account(),
            alice(),
            template_id,
            "wrong_hash".into(),
            "My Agent".into(),
            vec![],
        );
    }

    #[test]
    fn test_deactivate_instance() {
        let mut contract = init_contract();
        let template_id = register_test_template(&mut contract);

        setup_context(&alice());
        contract.register_instance(
            agent_account(),
            alice(),
            template_id,
            "abc123hash".into(),
            "My Agent".into(),
            vec![],
        );

        contract.deactivate_instance(agent_account());

        let instance = contract.get_instance(agent_account()).unwrap();
        assert_eq!(instance.status, AgentStatus::Deactivated);
    }

    #[test]
    #[should_panic(expected = "Unauthorized")]
    fn test_deactivate_by_non_owner() {
        let mut contract = init_contract();
        let template_id = register_test_template(&mut contract);

        setup_context(&alice());
        contract.register_instance(
            agent_account(),
            alice(),
            template_id,
            "abc123hash".into(),
            "My Agent".into(),
            vec![],
        );

        setup_context(&owner());
        contract.deactivate_instance(agent_account());
    }

    #[test]
    fn test_verify_instance() {
        let mut contract = init_contract();
        let template_id = register_test_template(&mut contract);

        setup_context(&alice());
        contract.register_instance(
            agent_account(),
            alice(),
            template_id,
            "abc123hash".into(),
            "My Agent".into(),
            vec![],
        );

        let result = contract.verify_instance(agent_account());
        assert!(result.valid);
        assert!(!result.is_audited);
    }

    #[test]
    fn test_verify_nonexistent_instance() {
        let contract = init_contract();
        let result = contract.verify_instance("nonexistent.testnet".parse().unwrap());
        assert!(!result.valid);
        assert!(result.reason.unwrap().contains("not found"));
    }

    #[test]
    fn test_mark_audited() {
        let mut contract = init_contract();
        let template_id = register_test_template(&mut contract);

        setup_context(&owner());
        contract.mark_audited(template_id.clone());

        let template = contract.get_template(template_id).unwrap();
        assert!(template.is_audited);
        assert!(contract.is_codehash_verified("abc123hash".into()));
    }

    #[test]
    fn test_record_attestation() {
        let mut contract = init_contract();
        let template_id = register_test_template(&mut contract);

        setup_context(&alice());
        contract.register_instance(
            agent_account(),
            alice(),
            template_id,
            "abc123hash".into(),
            "My Agent".into(),
            vec![],
        );

        contract.record_attestation(
            agent_account(),
            Attestation {
                codehash: "abc123hash".into(),
                tee_type: "intel-tdx".into(),
                attestation_document: "base64doc".into(),
                signature: "sig123".into(),
                timestamp: 1_700_000_000 * 1_000_000_000,
                verified: true,
            },
        );

        let instance = contract.get_instance(agent_account()).unwrap();
        let attestation = instance.last_attestation.unwrap();
        assert_eq!(attestation.tee_type, "intel-tdx");
        assert!(attestation.verified);
    }

    #[test]
    fn test_get_instances_by_owner() {
        let mut contract = init_contract();
        let template_id = register_test_template(&mut contract);

        setup_context(&alice());
        contract.register_instance(
            agent_account(),
            alice(),
            template_id,
            "abc123hash".into(),
            "My Agent".into(),
            vec![],
        );

        let instances = contract.get_instances_by_owner(alice());
        assert_eq!(instances.len(), 1);
        assert_eq!(instances[0].account_id, agent_account());
    }

    #[test]
    fn test_pause_blocks_operations() {
        let mut contract = init_contract();

        setup_context(&owner());
        contract.set_paused(true);

        setup_context(&alice());
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            contract.register_template(
                "tmpl-1".into(),
                "Test".into(),
                "Test".into(),
                "1.0.0".into(),
                "hash".into(),
                "url".into(),
                None,
                vec![],
                vec![],
            );
        }));
        assert!(result.is_err());
    }

    #[test]
    fn test_record_invocation() {
        let mut contract = init_contract();
        let template_id = register_test_template(&mut contract);

        setup_context(&alice());
        contract.register_instance(
            agent_account(),
            alice(),
            template_id,
            "abc123hash".into(),
            "My Agent".into(),
            vec![],
        );

        let count = contract.record_invocation(agent_account(), "analysis".into());
        assert_eq!(count, 1);

        let count = contract.record_invocation(agent_account(), "summary".into());
        assert_eq!(count, 2);

        let instance = contract.get_instance(agent_account()).unwrap();
        assert_eq!(instance.invocation_count, 2);
        assert!(instance.last_active_at.is_some());
    }

    #[test]
    #[should_panic(expected = "Unauthorized")]
    fn test_record_invocation_unauthorized() {
        let mut contract = init_contract();
        let template_id = register_test_template(&mut contract);

        setup_context(&alice());
        contract.register_instance(
            agent_account(),
            alice(),
            template_id,
            "abc123hash".into(),
            "My Agent".into(),
            vec![],
        );

        // Owner (the contract admin) is not the agent owner (alice) or the agent itself
        setup_context(&owner());
        contract.record_invocation(agent_account(), "analysis".into());
    }

    #[test]
    fn test_verify_codehash_admin() {
        let mut contract = init_contract();

        setup_context(&owner());
        contract.verify_codehash("custom-hash".into());
        assert!(contract.is_codehash_verified("custom-hash".into()));
        assert!(!contract.is_codehash_verified("other-hash".into()));
    }
}
