//! Generates real Groth16 proof fixtures for E2E testing.
//!
//! Uses the SquareCircuit (x * x == y) to produce pre-formatted JSON args
//! for each `near call` in the E2E test script. This avoids any runtime
//! dependency on Node.js for JSON construction.
//!
//! Output files (written to ../../scripts/fixtures/):
//!   zk-square-circuit.json       — raw VK + proof data
//!   zk-set-vk-args.json          — args for set_verification_key
//!   zk-valid-proof-args.json     — args for verify_proof (correct signal y=9)
//!   zk-invalid-proof-args.json   — args for verify_proof (wrong signal y=10)
//!   zk-valid-view-args.json      — args for verify_proof_view (correct signal)
//!
//! Usage:
//!   cd contracts/zk-verifier
//!   cargo run --example generate_fixtures

use ark_bn254::{Bn254, Fr, G1Affine, G2Affine};
use ark_groth16::Groth16 as ArkGroth16;
use ark_relations::r1cs::{ConstraintSynthesizer, ConstraintSystemRef, LinearCombination, SynthesisError};
use ark_snark::SNARK;
use ark_std::rand::SeedableRng;
use serde_json::json;
use std::fs;
use std::path::Path;

/// Trivial circuit: x * x == y  (1 constraint, 1 public input y)
#[derive(Clone)]
struct SquareCircuit {
    x: Option<Fr>,
}

impl ConstraintSynthesizer<Fr> for SquareCircuit {
    fn generate_constraints(self, cs: ConstraintSystemRef<Fr>) -> Result<(), SynthesisError> {
        use ark_ff::One;

        let x_val = self.x.unwrap_or_default();
        let y_val = x_val * x_val;

        let x_var = cs.new_witness_variable(|| Ok(x_val))?;
        let y_var = cs.new_input_variable(|| Ok(y_val))?;

        let a = LinearCombination::from((Fr::one(), x_var));
        let b = LinearCombination::from((Fr::one(), x_var));
        let c = LinearCombination::from((Fr::one(), y_var));
        cs.enforce_constraint(a, b, c)?;

        Ok(())
    }
}

/// Convert G1Affine to snarkjs-format string array [x, y].
fn g1_to_strings(point: &G1Affine) -> Vec<String> {
    vec![point.x.to_string(), point.y.to_string()]
}

/// Convert G2Affine to snarkjs-format nested arrays.
/// snarkjs outputs G2 Fq2 as [c1, c0], so swap from arkworks (c0, c1).
fn g2_to_strings(point: &G2Affine) -> Vec<Vec<String>> {
    vec![
        vec![point.x.c1.to_string(), point.x.c0.to_string()],
        vec![point.y.c1.to_string(), point.y.c0.to_string()],
    ]
}

fn main() {
    let fixtures_dir = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("scripts")
        .join("fixtures");
    fs::create_dir_all(&fixtures_dir).expect("Failed to create fixtures dir");

    // Deterministic RNG so fixtures are reproducible
    let mut rng = ark_std::rand::rngs::StdRng::seed_from_u64(42);

    // Setup: generate proving and verifying keys
    let circuit = SquareCircuit { x: None };
    let (pk, ark_vk) = ArkGroth16::<Bn254>::circuit_specific_setup(circuit, &mut rng).unwrap();

    // Prove: x = 3, y = x*x = 9
    let x = Fr::from(3u64);
    let circuit = SquareCircuit { x: Some(x) };
    let ark_proof = ArkGroth16::<Bn254>::prove(&pk, circuit, &mut rng).unwrap();

    // Convert to contract format
    let vk = json!({
        "alpha": g1_to_strings(&ark_vk.alpha_g1),
        "beta": g2_to_strings(&ark_vk.beta_g2),
        "gamma": g2_to_strings(&ark_vk.gamma_g2),
        "delta": g2_to_strings(&ark_vk.delta_g2),
        "ic": ark_vk.gamma_abc_g1.iter().map(g1_to_strings).collect::<Vec<_>>()
    });

    let proof = json!({
        "pi_a": g1_to_strings(&ark_proof.a),
        "pi_b": g2_to_strings(&ark_proof.b),
        "pi_c": g1_to_strings(&ark_proof.c)
    });

    // 1. Raw fixture data
    let raw = json!({
        "circuit": "SquareCircuit: x * x == y, where x=3 and y=9",
        "vk": vk,
        "proof": proof,
        "valid_signal": "9",
        "invalid_signal": "10"
    });
    write_json(&fixtures_dir, "zk-square-circuit.json", &raw);

    // 2. set_verification_key args
    let set_vk_args = json!({
        "circuit_type": "verified-builder",
        "vk": vk
    });
    write_json(&fixtures_dir, "zk-set-vk-args.json", &set_vk_args);

    // 3. verify_proof args — valid signal (y=9)
    let valid_proof_args = json!({
        "input": {
            "circuit_type": "verified-builder",
            "proof": proof,
            "public_signals": ["9"],
            "store_credential": true,
            "custom_expiration": 3600,
            "claim": "e2e-real-groth16-test"
        }
    });
    write_json(&fixtures_dir, "zk-valid-proof-args.json", &valid_proof_args);

    // 4. verify_proof args — invalid signal (y=10, should be 9)
    let invalid_proof_args = json!({
        "input": {
            "circuit_type": "verified-builder",
            "proof": proof,
            "public_signals": ["10"],
            "store_credential": true,
            "custom_expiration": 3600,
            "claim": "should-not-be-stored"
        }
    });
    write_json(&fixtures_dir, "zk-invalid-proof-args.json", &invalid_proof_args);

    // 5. verify_proof_view args — valid signal (no storage)
    let valid_view_args = json!({
        "input": {
            "circuit_type": "verified-builder",
            "proof": proof,
            "public_signals": ["9"],
            "store_credential": false
        }
    });
    write_json(&fixtures_dir, "zk-valid-view-args.json", &valid_view_args);

    println!("Generated fixtures in {}", fixtures_dir.display());
    println!("  zk-square-circuit.json     — raw VK + proof data");
    println!("  zk-set-vk-args.json        — set_verification_key args");
    println!("  zk-valid-proof-args.json   — verify_proof (valid, y=9)");
    println!("  zk-invalid-proof-args.json — verify_proof (invalid, y=10)");
    println!("  zk-valid-view-args.json    — verify_proof_view (valid)");
}

fn write_json(dir: &Path, name: &str, value: &serde_json::Value) {
    let path = dir.join(name);
    let content = serde_json::to_string(value).expect("Failed to serialize JSON");
    fs::write(&path, &content).unwrap_or_else(|e| panic!("Failed to write {}: {e}", path.display()));
}
