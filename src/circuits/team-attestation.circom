/*
 * Team Attestation Circuit
 *
 * Proves that a builder has received at least `minAttestations` endorsements
 * from verified team members, without revealing who attested.
 *
 * Uses EdDSA Poseidon signatures for attestation verification and
 * Merkle proofs to verify attesters are in the recognized attesters set.
 *
 * Public inputs:
 *   attestersRoot    — Merkle root of the recognized attesters tree
 *   minAttestations  — Minimum number of valid attestations required
 *   credentialType   — Type of credential being attested (numeric ID)
 *
 * Private inputs (witness):
 *   attesterPubKeyX[maxAttestations]                  — Attester public key X coordinates
 *   attesterPubKeyY[maxAttestations]                  — Attester public key Y coordinates
 *   signatureR8X[maxAttestations]                     — Signature R8 X coordinates
 *   signatureR8Y[maxAttestations]                     — Signature R8 Y coordinates
 *   signatureS[maxAttestations]                       — Signature S values
 *   attestationMessages[maxAttestations]              — Message hashes that were signed
 *   attesterPathElements[maxAttestations][depth]      — Merkle proof siblings
 *   attesterPathIndices[maxAttestations][depth]       — Merkle proof path indices
 *
 * Constraints: ~16K estimated (EdDSA is expensive)
 */

pragma circom 2.1.0;

include "lib/poseidon.circom";
include "lib/comparators.circom";
include "lib/merkle.circom";
include "node_modules/circomlib/circuits/eddsaposeidon.circom";

template TeamAttestation(maxAttestations, depth) {
    // Public inputs
    signal input attestersRoot;
    signal input minAttestations;
    signal input credentialType;

    // Private inputs — attestation signatures
    signal input attesterPubKeyX[maxAttestations];
    signal input attesterPubKeyY[maxAttestations];
    signal input signatureR8X[maxAttestations];
    signal input signatureR8Y[maxAttestations];
    signal input signatureS[maxAttestations];
    signal input attestationMessages[maxAttestations];

    // Private inputs — attester Merkle proofs
    signal input attesterPathElements[maxAttestations][depth];
    signal input attesterPathIndices[maxAttestations][depth];

    // Output: 1 if proof is valid
    signal output valid;

    // Count valid attestations
    component isNonZero[maxAttestations];
    component eddsaVerify[maxAttestations];
    component attesterMerkle[maxAttestations];
    signal validCount[maxAttestations + 1];
    validCount[0] <== 0;

    component msgHash[maxAttestations];
    component pubKeyHash[maxAttestations];
    signal rootDiff[maxAttestations];

    for (var i = 0; i < maxAttestations; i++) {
        // Check if this slot has an attestation (non-zero pub key X)
        isNonZero[i] = IsNonZero();
        isNonZero[i].in <== attesterPubKeyX[i];

        // Verify EdDSA Poseidon signature
        // The message includes the credential type to bind attestation to purpose
        msgHash[i] = Poseidon(2);
        msgHash[i].inputs[0] <== attestationMessages[i];
        msgHash[i].inputs[1] <== credentialType;

        eddsaVerify[i] = EdDSAPoseidonVerifier();
        eddsaVerify[i].enabled <== isNonZero[i].out;
        eddsaVerify[i].Ax <== attesterPubKeyX[i];
        eddsaVerify[i].Ay <== attesterPubKeyY[i];
        eddsaVerify[i].R8x <== signatureR8X[i];
        eddsaVerify[i].R8y <== signatureR8Y[i];
        eddsaVerify[i].S <== signatureS[i];
        eddsaVerify[i].M <== msgHash[i].out;

        // Hash public key to create leaf for attester tree
        pubKeyHash[i] = Poseidon(2);
        pubKeyHash[i].inputs[0] <== attesterPubKeyX[i];
        pubKeyHash[i].inputs[1] <== attesterPubKeyY[i];

        // Verify attester is in the recognized set via Merkle proof
        attesterMerkle[i] = MerkleRoot(depth);
        attesterMerkle[i].leaf <== pubKeyHash[i].out;
        for (var j = 0; j < depth; j++) {
            attesterMerkle[i].pathElements[j] <== attesterPathElements[i][j];
            attesterMerkle[i].pathIndices[j] <== attesterPathIndices[i][j];
        }

        // If attestation is non-zero, Merkle root must match
        rootDiff[i] <== attesterMerkle[i].root - attestersRoot;
        isNonZero[i].out * rootDiff[i] === 0;

        // Count valid attestation
        validCount[i + 1] <== validCount[i] + isNonZero[i].out;
    }

    // Padding constraints (Fix #6):
    // For padding slots (attesterPubKeyX[i] == 0), constrain all witness data to zero.
    // This prevents a malicious prover from smuggling data through unused slots.
    signal paddingPath[maxAttestations][depth];
    signal paddingIndex[maxAttestations][depth];
    signal paddingPubKeyY[maxAttestations];
    signal paddingR8X[maxAttestations];
    signal paddingR8Y[maxAttestations];
    signal paddingS[maxAttestations];
    signal paddingMsg[maxAttestations];
    for (var i = 0; i < maxAttestations; i++) {
        // Constrain padding Merkle proof data to zero
        for (var j = 0; j < depth; j++) {
            paddingPath[i][j] <== (1 - isNonZero[i].out) * attesterPathElements[i][j];
            paddingPath[i][j] === 0;
            paddingIndex[i][j] <== (1 - isNonZero[i].out) * attesterPathIndices[i][j];
            paddingIndex[i][j] === 0;
        }
        // Constrain padding signature components to zero
        paddingPubKeyY[i] <== (1 - isNonZero[i].out) * attesterPubKeyY[i];
        paddingPubKeyY[i] === 0;
        paddingR8X[i] <== (1 - isNonZero[i].out) * signatureR8X[i];
        paddingR8X[i] === 0;
        paddingR8Y[i] <== (1 - isNonZero[i].out) * signatureR8Y[i];
        paddingR8Y[i] === 0;
        paddingS[i] <== (1 - isNonZero[i].out) * signatureS[i];
        paddingS[i] === 0;
        paddingMsg[i] <== (1 - isNonZero[i].out) * attestationMessages[i];
        paddingMsg[i] === 0;
    }

    // Enforce uniqueness (Fix #3): no two non-zero attesters may share the same
    // public key (X, Y). X-only comparison is insufficient because Baby Jubjub
    // has two valid Y values for each X (the curve equation yields ±Y).
    // A malicious prover could submit the same key with +Y and -Y to double-count.
    component isAttesterXDiffZero[maxAttestations * (maxAttestations - 1) / 2];
    component isAttesterYDiffZero[maxAttestations * (maxAttestations - 1) / 2];
    signal sameAttesterXY[maxAttestations * (maxAttestations - 1) / 2];
    signal bothAttesterExist[maxAttestations * (maxAttestations - 1) / 2];
    var attIdx = 0;
    for (var i = 0; i < maxAttestations; i++) {
        for (var j = i + 1; j < maxAttestations; j++) {
            bothAttesterExist[attIdx] <== isNonZero[i].out * isNonZero[j].out;
            isAttesterXDiffZero[attIdx] = IsZero();
            isAttesterXDiffZero[attIdx].in <== attesterPubKeyX[i] - attesterPubKeyX[j];
            isAttesterYDiffZero[attIdx] = IsZero();
            isAttesterYDiffZero[attIdx].in <== attesterPubKeyY[i] - attesterPubKeyY[j];
            // Both X and Y must match for a duplicate (same point on curve)
            sameAttesterXY[attIdx] <== isAttesterXDiffZero[attIdx].out * isAttesterYDiffZero[attIdx].out;
            // If both slots are non-zero AND keys are identical → impossible
            bothAttesterExist[attIdx] * sameAttesterXY[attIdx] === 0;
            attIdx++;
        }
    }

    // Verify attestation count meets minimum
    component geq = GreaterEqThan(32);
    geq.in[0] <== validCount[maxAttestations];
    geq.in[1] <== minAttestations;

    valid <== geq.out;
}

// Default instantiation: max 5 attestations, Merkle depth 20
component main {public [attestersRoot, minAttestations, credentialType]} = TeamAttestation(5, 20);
