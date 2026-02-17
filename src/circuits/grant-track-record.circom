/*
 * Grant Track Record Circuit
 *
 * Proves that a builder has completed at least `minGrants` grants
 * across verified programs, without revealing grant details or amounts.
 *
 * Uses dual Merkle verification:
 *   1. Grant tree — proves grant existence and completion
 *   2. Program tree — proves grant belongs to a recognized program
 *
 * Public inputs:
 *   grantRoot    — Merkle root of the grant tree
 *   minGrants    — Minimum number of completed grants required
 *   programsRoot — Merkle root of the recognized programs tree
 *
 * Private inputs (witness):
 *   grantIds[maxGrants]                          — Poseidon-hashed grant IDs (0-padded)
 *   completionFlags[maxGrants]                   — 1 if grant completed, 0 otherwise
 *   grantPathElements[maxGrants][grantDepth]     — Grant Merkle proof siblings
 *   grantPathIndices[maxGrants][grantDepth]      — Grant Merkle proof path indices
 *   programIds[maxGrants]                        — Poseidon-hashed program IDs
 *   programPathElements[maxGrants][programDepth] — Program Merkle proof siblings
 *   programPathIndices[maxGrants][programDepth]  — Program Merkle proof path indices
 *
 * Constraints: ~9K estimated
 */

pragma circom 2.1.0;

include "lib/poseidon.circom";
include "lib/comparators.circom";
include "lib/merkle.circom";

template GrantTrackRecord(maxGrants, grantDepth, programDepth) {
    // Public inputs
    signal input grantRoot;
    signal input minGrants;
    signal input programsRoot;

    // Private inputs — grant tree
    signal input grantIds[maxGrants];
    signal input completionFlags[maxGrants];
    signal input grantPathElements[maxGrants][grantDepth];
    signal input grantPathIndices[maxGrants][grantDepth];

    // Private inputs — program tree
    signal input programIds[maxGrants];
    signal input programPathElements[maxGrants][programDepth];
    signal input programPathIndices[maxGrants][programDepth];

    // Output: 1 if proof is valid
    signal output valid;

    // Count completed grants and verify each
    component isNonZero[maxGrants];
    component grantMerkle[maxGrants];
    component programMerkle[maxGrants];
    signal completedCount[maxGrants + 1];
    completedCount[0] <== 0;

    signal isCompleted[maxGrants];
    component grantLeafHash[maxGrants];
    signal grantRootDiff[maxGrants];
    signal programRootDiff[maxGrants];

    for (var i = 0; i < maxGrants; i++) {
        // Check if this slot has a grant (non-zero)
        isNonZero[i] = IsNonZero();
        isNonZero[i].in <== grantIds[i];

        // Constrain completion flag to be binary
        completionFlags[i] * (1 - completionFlags[i]) === 0;

        // A grant counts as completed if it exists AND is marked complete
        isCompleted[i] <== isNonZero[i].out * completionFlags[i];
        completedCount[i + 1] <== completedCount[i] + isCompleted[i];

        // Hash grant ID + completion flag as the leaf
        grantLeafHash[i] = Poseidon(2);
        grantLeafHash[i].inputs[0] <== grantIds[i];
        grantLeafHash[i].inputs[1] <== completionFlags[i];

        // Verify grant Merkle proof
        grantMerkle[i] = MerkleRoot(grantDepth);
        grantMerkle[i].leaf <== grantLeafHash[i].out;
        for (var j = 0; j < grantDepth; j++) {
            grantMerkle[i].pathElements[j] <== grantPathElements[i][j];
            grantMerkle[i].pathIndices[j] <== grantPathIndices[i][j];
        }

        // If grant is non-zero, its root must match
        grantRootDiff[i] <== grantMerkle[i].root - grantRoot;
        isNonZero[i].out * grantRootDiff[i] === 0;

        // Verify program Merkle proof
        programMerkle[i] = MerkleRoot(programDepth);
        programMerkle[i].leaf <== programIds[i];
        for (var j = 0; j < programDepth; j++) {
            programMerkle[i].pathElements[j] <== programPathElements[i][j];
            programMerkle[i].pathIndices[j] <== programPathIndices[i][j];
        }

        // If grant is non-zero, program root must match
        programRootDiff[i] <== programMerkle[i].root - programsRoot;
        isNonZero[i].out * programRootDiff[i] === 0;
    }

    // Padding constraints (Fix #6):
    // For padding slots (grantIds[i] == 0), constrain Merkle proof paths and indices
    // to zero. This prevents a malicious prover from smuggling data through padding.
    signal grantPaddingPath[maxGrants][grantDepth];
    signal grantPaddingIndex[maxGrants][grantDepth];
    signal programPaddingPath[maxGrants][programDepth];
    signal programPaddingIndex[maxGrants][programDepth];
    for (var i = 0; i < maxGrants; i++) {
        for (var j = 0; j < grantDepth; j++) {
            grantPaddingPath[i][j] <== (1 - isNonZero[i].out) * grantPathElements[i][j];
            grantPaddingPath[i][j] === 0;
            grantPaddingIndex[i][j] <== (1 - isNonZero[i].out) * grantPathIndices[i][j];
            grantPaddingIndex[i][j] === 0;
        }
        for (var j = 0; j < programDepth; j++) {
            programPaddingPath[i][j] <== (1 - isNonZero[i].out) * programPathElements[i][j];
            programPaddingPath[i][j] === 0;
            programPaddingIndex[i][j] <== (1 - isNonZero[i].out) * programPathIndices[i][j];
            programPaddingIndex[i][j] === 0;
        }
    }

    // Enforce uniqueness: no two non-zero grant IDs may be the same.
    // For maxGrants=10, this adds 45 pairwise checks — modest overhead.
    component isDiffZero[maxGrants * (maxGrants - 1) / 2];
    signal bothExist[maxGrants * (maxGrants - 1) / 2];
    var idx = 0;
    for (var i = 0; i < maxGrants; i++) {
        for (var j = i + 1; j < maxGrants; j++) {
            bothExist[idx] <== isNonZero[i].out * isNonZero[j].out;
            isDiffZero[idx] = IsZero();
            isDiffZero[idx].in <== grantIds[i] - grantIds[j];
            // If both slots are non-zero AND IDs are the same → impossible
            bothExist[idx] * isDiffZero[idx].out === 0;
            idx++;
        }
    }

    // Verify completed count meets minimum
    component geq = GreaterEqThan(32);
    geq.in[0] <== completedCount[maxGrants];
    geq.in[1] <== minGrants;

    valid <== geq.out;
}

// Default instantiation: max 10 grants, grant depth 15, program depth 10
component main {public [grantRoot, minGrants, programsRoot]} = GrantTrackRecord(10, 15, 10);
