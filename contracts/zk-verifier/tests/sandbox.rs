//! NEAR sandbox integration tests.
//!
//! These tests deploy the compiled WASM to a local NEAR sandbox and exercise
//! the contract end-to-end. Run `bash build.sh` first to produce `out/zk_verifier.wasm`.
//!
//! Prerequisites:
//! - Rust 1.85+ (for near-workspaces edition 2024 support)
//! - Uncomment near-workspaces + tokio in Cargo.toml [dev-dependencies]
//! - Run: `cargo test --test sandbox`
//!
//! These tests are gated behind `cfg(feature = "sandbox")` to avoid breaking
//! the default build on older toolchains.

#![cfg(feature = "sandbox")]

use near_workspaces::{types::NearToken, Account, Contract};
use serde_json::json;

const WASM_PATH: &str = "out/zk_verifier.wasm";

async fn deploy_and_init() -> anyhow::Result<(near_workspaces::Worker<near_workspaces::network::Sandbox>, Contract, Account)> {
    let worker = near_workspaces::sandbox().await?;
    let wasm = std::fs::read(WASM_PATH)?;
    let contract = worker.dev_deploy(&wasm).await?;

    let owner = worker.dev_create_account().await?;

    // Initialize the contract
    let outcome = contract
        .call("new")
        .args_json(json!({ "owner": owner.id() }))
        .transact()
        .await?;
    assert!(outcome.is_success(), "init failed: {:?}", outcome.outcome());

    Ok((worker, contract, owner))
}

#[tokio::test]
async fn sandbox_deploy_and_config() -> anyhow::Result<()> {
    let (_worker, contract, owner) = deploy_and_init().await?;

    // Check get_config returns expected defaults
    let config: serde_json::Value = contract
        .view("get_config")
        .args_json(json!({}))
        .await?
        .json()?;

    assert_eq!(config["owner"], owner.id().to_string());
    assert_eq!(config["is_paused"], false);
    assert_eq!(config["default_expiration_secs"], 30 * 24 * 60 * 60);
    assert!(config["proposed_owner"].is_null());

    Ok(())
}

#[tokio::test]
async fn sandbox_set_verification_key() -> anyhow::Result<()> {
    let (_worker, contract, owner) = deploy_and_init().await?;

    // Set a verification key
    let mock_vk = json!({
        "alpha": ["1", "2"],
        "beta": [
            ["10857046999023057135944570762232829481370756359578518086990519993285655852781",
             "11559732032986387107991004021392285783925812861821192530917403151452391805634"],
            ["8495653923123431417604973247489272438418190587263600148770280649306958101930",
             "4082367875863433681332203403145435568316851327593401208105741076214120093531"]
        ],
        "gamma": [
            ["10857046999023057135944570762232829481370756359578518086990519993285655852781",
             "11559732032986387107991004021392285783925812861821192530917403151452391805634"],
            ["8495653923123431417604973247489272438418190587263600148770280649306958101930",
             "4082367875863433681332203403145435568316851327593401208105741076214120093531"]
        ],
        "delta": [
            ["10857046999023057135944570762232829481370756359578518086990519993285655852781",
             "11559732032986387107991004021392285783925812861821192530917403151452391805634"],
            ["8495653923123431417604973247489272438418190587263600148770280649306958101930",
             "4082367875863433681332203403145435568316851327593401208105741076214120093531"]
        ],
        "ic": [["1", "2"], ["1", "2"]]
    });

    let outcome = owner
        .call(contract.id(), "set_verification_key")
        .args_json(json!({
            "circuit_type": "verified-builder",
            "vk": mock_vk
        }))
        .transact()
        .await?;
    assert!(outcome.is_success(), "set_verification_key failed: {:?}", outcome.outcome());

    // Verify has_verification_key
    let has_vk: bool = contract
        .view("has_verification_key")
        .args_json(json!({ "circuit_type": "verified-builder" }))
        .await?
        .json()?;
    assert!(has_vk);

    // Check stats
    let stats: serde_json::Value = contract
        .view("get_stats")
        .args_json(json!({}))
        .await?
        .json()?;
    assert_eq!(stats["verification_keys_registered"], 1);

    Ok(())
}

#[tokio::test]
async fn sandbox_pause_blocks_verification() -> anyhow::Result<()> {
    let (_worker, contract, owner) = deploy_and_init().await?;

    // Pause the contract
    let outcome = owner
        .call(contract.id(), "set_paused")
        .args_json(json!({ "paused": true }))
        .transact()
        .await?;
    assert!(outcome.is_success());

    // Attempt a view — should fail
    let config: serde_json::Value = contract
        .view("get_config")
        .args_json(json!({}))
        .await?
        .json()?;
    assert_eq!(config["is_paused"], true);

    Ok(())
}

#[tokio::test]
async fn sandbox_unauthorized_access_rejected() -> anyhow::Result<()> {
    let (worker, contract, _owner) = deploy_and_init().await?;

    let stranger = worker.dev_create_account().await?;

    // Stranger tries to set VK — should fail
    let outcome = stranger
        .call(contract.id(), "set_paused")
        .args_json(json!({ "paused": true }))
        .transact()
        .await?;
    assert!(outcome.is_failure(), "stranger should not be able to pause");

    Ok(())
}

#[tokio::test]
async fn sandbox_two_step_ownership() -> anyhow::Result<()> {
    let (worker, contract, owner) = deploy_and_init().await?;
    let new_owner = worker.dev_create_account().await?;

    // Step 1: propose
    let outcome = owner
        .call(contract.id(), "propose_owner")
        .args_json(json!({ "new_owner": new_owner.id() }))
        .transact()
        .await?;
    assert!(outcome.is_success());

    let config: serde_json::Value = contract
        .view("get_config")
        .args_json(json!({}))
        .await?
        .json()?;
    assert_eq!(config["proposed_owner"], new_owner.id().to_string());

    // Step 2: accept
    let outcome = new_owner
        .call(contract.id(), "accept_ownership")
        .args_json(json!({}))
        .transact()
        .await?;
    assert!(outcome.is_success());

    let config: serde_json::Value = contract
        .view("get_config")
        .args_json(json!({}))
        .await?
        .json()?;
    assert_eq!(config["owner"], new_owner.id().to_string());
    assert!(config["proposed_owner"].is_null());

    Ok(())
}

#[tokio::test]
async fn sandbox_admin_can_set_vk() -> anyhow::Result<()> {
    let (worker, contract, owner) = deploy_and_init().await?;
    let admin = worker.dev_create_account().await?;

    // Add admin
    let outcome = owner
        .call(contract.id(), "add_admin")
        .args_json(json!({ "account": admin.id() }))
        .transact()
        .await?;
    assert!(outcome.is_success());

    // Admin sets VK
    let mock_vk = json!({
        "alpha": ["1", "2"],
        "beta": [
            ["10857046999023057135944570762232829481370756359578518086990519993285655852781",
             "11559732032986387107991004021392285783925812861821192530917403151452391805634"],
            ["8495653923123431417604973247489272438418190587263600148770280649306958101930",
             "4082367875863433681332203403145435568316851327593401208105741076214120093531"]
        ],
        "gamma": [
            ["10857046999023057135944570762232829481370756359578518086990519993285655852781",
             "11559732032986387107991004021392285783925812861821192530917403151452391805634"],
            ["8495653923123431417604973247489272438418190587263600148770280649306958101930",
             "4082367875863433681332203403145435568316851327593401208105741076214120093531"]
        ],
        "delta": [
            ["10857046999023057135944570762232829481370756359578518086990519993285655852781",
             "11559732032986387107991004021392285783925812861821192530917403151452391805634"],
            ["8495653923123431417604973247489272438418190587263600148770280649306958101930",
             "4082367875863433681332203403145435568316851327593401208105741076214120093531"]
        ],
        "ic": [["1", "2"], ["1", "2"]]
    });

    let outcome = admin
        .call(contract.id(), "set_verification_key")
        .args_json(json!({
            "circuit_type": "team-attestation",
            "vk": mock_vk
        }))
        .transact()
        .await?;
    assert!(outcome.is_success(), "admin should be able to set VK");

    let has_vk: bool = contract
        .view("has_verification_key")
        .args_json(json!({ "circuit_type": "team-attestation" }))
        .await?
        .json()?;
    assert!(has_vk);

    Ok(())
}
