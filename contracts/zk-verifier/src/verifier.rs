use ark_bn254::{Bn254, Fq, Fq2, Fr, G1Affine, G2Affine};
use ark_ec::{pairing::Pairing, AffineRepr};
use ark_ff::{PrimeField, Zero};

use crate::errors::ContractError;
use crate::types::{Groth16Proof, VerificationKey};

/// Parse a decimal string into an ark_bn254 field element.
fn parse_field_element<F: PrimeField>(s: &str) -> Result<F, ContractError> {
    F::from_str(s).map_err(|_| {
        ContractError::InvalidProofFormat(format!("Cannot parse field element: {s}"))
    })
}

/// Parse a G1 affine point from a snarkjs-format string array [x, y, "1"].
fn parse_g1_point(coords: &[String]) -> Result<G1Affine, ContractError> {
    if coords.len() < 2 {
        return Err(ContractError::InvalidProofFormat(
            "G1 point requires at least 2 coordinates".into(),
        ));
    }
    let x: Fq = parse_field_element(&coords[0])?;
    let y: Fq = parse_field_element(&coords[1])?;
    let point = G1Affine::new_unchecked(x, y);

    if !point.is_on_curve() {
        return Err(ContractError::InvalidProofFormat(
            "G1 point is not on curve".into(),
        ));
    }
    Ok(point)
}

/// Parse a G2 affine point from snarkjs-format nested arrays.
///
/// **Critical**: snarkjs outputs G2 `Fq2` components as `[c1, c0]`,
/// but arkworks `Fq2::new()` expects `(c0, c1)`. We must swap.
fn parse_g2_point(coords: &[Vec<String>]) -> Result<G2Affine, ContractError> {
    if coords.len() < 2 {
        return Err(ContractError::InvalidProofFormat(
            "G2 point requires at least 2 coordinate pairs".into(),
        ));
    }
    if coords[0].len() < 2 || coords[1].len() < 2 {
        return Err(ContractError::InvalidProofFormat(
            "G2 coordinate pair requires 2 elements".into(),
        ));
    }

    // snarkjs: [c1, c0] → arkworks: Fq2::new(c0, c1)
    let x_c1: Fq = parse_field_element(&coords[0][0])?;
    let x_c0: Fq = parse_field_element(&coords[0][1])?;
    let y_c1: Fq = parse_field_element(&coords[1][0])?;
    let y_c0: Fq = parse_field_element(&coords[1][1])?;

    let x = Fq2::new(x_c0, x_c1);
    let y = Fq2::new(y_c0, y_c1);
    let point = G2Affine::new_unchecked(x, y);

    if !point.is_on_curve() {
        return Err(ContractError::InvalidProofFormat(
            "G2 point is not on curve".into(),
        ));
    }
    // BN254 G2 has cofactor > 1 — on-curve alone is insufficient.
    // Reject points outside the prime-order subgroup to prevent pairing exploits.
    if !point.is_in_correct_subgroup_assuming_on_curve() {
        return Err(ContractError::InvalidProofFormat(
            "G2 point is not in the correct subgroup".into(),
        ));
    }
    Ok(point)
}

/// Verify a Groth16 proof against a verification key and public signals.
///
/// Checks the pairing equation:
///   e(A, B) == e(alpha, beta) * e(vk_x, gamma) * e(C, delta)
///
/// Which is equivalent to checking:
///   e(-A, B) * e(alpha, beta) * e(vk_x, gamma) * e(C, delta) == 1
pub fn verify_groth16_proof(
    vk: &VerificationKey,
    proof: &Groth16Proof,
    public_signals: &[String],
) -> Result<bool, ContractError> {
    // Validate public signals count: IC should have (num_public_inputs + 1) elements
    if vk.ic.len() != public_signals.len() + 1 {
        return Err(ContractError::InvalidPublicSignals(format!(
            "Expected {} public signals, got {}",
            vk.ic.len() - 1,
            public_signals.len()
        )));
    }

    // Parse proof points
    let a = parse_g1_point(&proof.pi_a)?;
    let b = parse_g2_point(&proof.pi_b)?;
    let c = parse_g1_point(&proof.pi_c)?;

    // Parse verification key points
    let alpha = parse_g1_point(&vk.alpha)?;
    let beta = parse_g2_point(&vk.beta)?;
    let gamma = parse_g2_point(&vk.gamma)?;
    let delta = parse_g2_point(&vk.delta)?;

    // Parse IC points
    let mut ic_points: Vec<G1Affine> = Vec::with_capacity(vk.ic.len());
    for ic_coord in &vk.ic {
        ic_points.push(parse_g1_point(ic_coord)?);
    }

    // Compute vk_x = IC[0] + sum(public_signals[i] * IC[i+1])
    let mut vk_x = ic_points[0].into_group();
    for (i, signal_str) in public_signals.iter().enumerate() {
        let signal: Fr = parse_field_element(signal_str)?;
        let ic_point = ic_points[i + 1].into_group();
        vk_x += ic_point * signal;
    }
    let vk_x_affine = G1Affine::from(vk_x);

    // Negate A for the pairing check: e(-A, B) * e(alpha, beta) * e(vk_x, gamma) * e(C, delta) == 1
    let neg_a = -a;

    // Multi-pairing check
    let result = Bn254::multi_pairing(
        [neg_a, alpha, vk_x_affine, c],
        [b, beta, gamma, delta],
    );

    Ok(result.is_zero())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_field_element_valid() {
        let result: Result<Fr, _> = parse_field_element("1");
        assert!(result.is_ok());

        let result: Result<Fq, _> = parse_field_element("0");
        assert!(result.is_ok());
    }

    #[test]
    fn test_parse_field_element_invalid() {
        let result: Result<Fr, _> = parse_field_element("not_a_number");
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_g1_point_too_few_coords() {
        let coords = vec!["1".to_string()];
        let result = parse_g1_point(&coords);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_g2_point_too_few_coords() {
        let coords = vec![vec!["1".to_string()]];
        let result = parse_g2_point(&coords);
        assert!(result.is_err());
    }

    #[test]
    fn test_verify_wrong_signal_count() {
        let vk = VerificationKey {
            alpha: vec!["0".into(), "0".into()],
            beta: vec![vec!["0".into(), "0".into()], vec!["0".into(), "0".into()]],
            gamma: vec![vec!["0".into(), "0".into()], vec!["0".into(), "0".into()]],
            delta: vec![vec!["0".into(), "0".into()], vec!["0".into(), "0".into()]],
            ic: vec![
                vec!["0".into(), "0".into()],
                vec!["0".into(), "0".into()],
            ], // expects 1 public signal
        };
        let proof = Groth16Proof {
            pi_a: vec!["0".into(), "0".into(), "1".into()],
            pi_b: vec![
                vec!["0".into(), "0".into()],
                vec!["0".into(), "0".into()],
                vec!["1".into(), "0".into()],
            ],
            pi_c: vec!["0".into(), "0".into(), "1".into()],
        };
        // 2 signals but vk expects 1
        let signals = vec!["1".into(), "2".into()];
        let result = verify_groth16_proof(&vk, &proof, &signals);
        assert!(result.is_err());
    }

    // -----------------------------------------------------------------------
    // Real cryptographic test using arkworks to generate a valid proof
    // -----------------------------------------------------------------------

    use ark_groth16::Groth16 as ArkGroth16;
    use ark_relations::r1cs::{ConstraintSynthesizer, ConstraintSystemRef, SynthesisError};
    use ark_snark::SNARK;
    use ark_std::rand::thread_rng;

    /// Trivial circuit: x * x == y  (1 constraint, 1 public input y)
    #[derive(Clone)]
    struct SquareCircuit {
        x: Option<Fr>,
    }

    impl ConstraintSynthesizer<Fr> for SquareCircuit {
        fn generate_constraints(self, cs: ConstraintSystemRef<Fr>) -> Result<(), SynthesisError> {
            use ark_relations::r1cs::LinearCombination;
            use ark_ff::One;

            let x_val = self.x.unwrap_or_default();
            let y_val = x_val * x_val;

            // Allocate private witness x
            let x_var = cs.new_witness_variable(|| Ok(x_val))?;
            // Allocate public input y = x^2
            let y_var = cs.new_input_variable(|| Ok(y_val))?;

            // Constraint: x * x = y
            // x_var and y_var are already Variable values — use them directly
            let a = LinearCombination::from((Fr::one(), x_var));
            let b = LinearCombination::from((Fr::one(), x_var));
            let c = LinearCombination::from((Fr::one(), y_var));
            cs.enforce_constraint(a, b, c)?;

            Ok(())
        }
    }

    /// Convert an arkworks G1Affine point to string coordinates [x, y].
    fn g1_to_strings(point: &G1Affine) -> Vec<String> {
        vec![
            point.x.to_string(),
            point.y.to_string(),
        ]
    }

    /// Convert an arkworks G2Affine point to snarkjs-format string coordinates.
    /// snarkjs outputs G2 Fq2 as [c1, c0], so we swap from arkworks (c0, c1).
    fn g2_to_strings(point: &G2Affine) -> Vec<Vec<String>> {
        vec![
            vec![point.x.c1.to_string(), point.x.c0.to_string()],
            vec![point.y.c1.to_string(), point.y.c0.to_string()],
        ]
    }

    /// Convert an arkworks VerifyingKey to our contract's VerificationKey format.
    fn vk_to_contract(
        vk: &ark_groth16::VerifyingKey<Bn254>,
    ) -> VerificationKey {
        VerificationKey {
            alpha: g1_to_strings(&vk.alpha_g1),
            beta: g2_to_strings(&vk.beta_g2),
            gamma: g2_to_strings(&vk.gamma_g2),
            delta: g2_to_strings(&vk.delta_g2),
            ic: vk.gamma_abc_g1.iter().map(g1_to_strings).collect(),
        }
    }

    /// Convert an arkworks Proof to our contract's Groth16Proof format.
    fn proof_to_contract(proof: &ark_groth16::Proof<Bn254>) -> Groth16Proof {
        Groth16Proof {
            pi_a: g1_to_strings(&proof.a),
            pi_b: g2_to_strings(&proof.b),
            pi_c: g1_to_strings(&proof.c),
        }
    }

    #[test]
    fn test_real_groth16_proof_valid() {
        use ark_bn254::Bn254;

        let mut rng = thread_rng();

        // Setup: generate proving and verifying keys for our trivial circuit
        let circuit = SquareCircuit { x: None };
        let (pk, ark_vk) = ArkGroth16::<Bn254>::circuit_specific_setup(circuit, &mut rng).unwrap();

        // Prove: x = 3, so y = 9
        let x = Fr::from(3u64);
        let circuit = SquareCircuit { x: Some(x) };
        let ark_proof = ArkGroth16::<Bn254>::prove(&pk, circuit, &mut rng).unwrap();

        // Convert to our contract format
        let contract_vk = vk_to_contract(&ark_vk);
        let contract_proof = proof_to_contract(&ark_proof);

        // Verify with correct public signal y = 9
        let result = verify_groth16_proof(&contract_vk, &contract_proof, &["9".to_string()]);
        assert!(result.is_ok(), "verification should not error: {:?}", result.err());
        assert!(result.unwrap(), "valid proof should verify as true");
    }

    #[test]
    fn test_real_groth16_proof_wrong_signal() {
        use ark_bn254::Bn254;

        let mut rng = thread_rng();

        let circuit = SquareCircuit { x: None };
        let (pk, ark_vk) = ArkGroth16::<Bn254>::circuit_specific_setup(circuit, &mut rng).unwrap();

        let x = Fr::from(3u64);
        let circuit = SquareCircuit { x: Some(x) };
        let ark_proof = ArkGroth16::<Bn254>::prove(&pk, circuit, &mut rng).unwrap();

        let contract_vk = vk_to_contract(&ark_vk);
        let contract_proof = proof_to_contract(&ark_proof);

        // Verify with WRONG public signal y = 10 (should be 9)
        let result = verify_groth16_proof(&contract_vk, &contract_proof, &["10".to_string()]);
        assert!(result.is_ok());
        assert!(!result.unwrap(), "wrong signal should make proof invalid");
    }

    #[test]
    fn test_real_groth16_proof_tampered() {
        use ark_bn254::Bn254;

        let mut rng = thread_rng();

        let circuit = SquareCircuit { x: None };
        let (pk, ark_vk) = ArkGroth16::<Bn254>::circuit_specific_setup(circuit, &mut rng).unwrap();

        let x = Fr::from(3u64);
        let circuit = SquareCircuit { x: Some(x) };
        let ark_proof = ArkGroth16::<Bn254>::prove(&pk, circuit, &mut rng).unwrap();

        let contract_vk = vk_to_contract(&ark_vk);
        let mut contract_proof = proof_to_contract(&ark_proof);

        // Tamper with pi_a x-coordinate
        contract_proof.pi_a[0] = "12345".to_string();

        let result = verify_groth16_proof(&contract_vk, &contract_proof, &["9".to_string()]);
        // Either returns Ok(false) or Err (if the tampered point is not on curve)
        match result {
            Ok(valid) => assert!(!valid, "tampered proof should not verify"),
            Err(_) => {} // Also acceptable — invalid point
        }
    }
}
