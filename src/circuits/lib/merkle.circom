/*
 * Merkle Tree Templates
 *
 * Provides Merkle proof verification and root computation using Poseidon hashing.
 * Uses MultiMux1 for branch selection (left/right child ordering).
 */

pragma circom 2.1.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/mux1.circom";

/**
 * MerkleProof(levels) — Verifies a Merkle inclusion proof.
 *
 * Given a leaf, its siblings along the path, and the path indices (0=left, 1=right),
 * computes the root and constrains it to match the expected root.
 *
 * Inputs:
 *   leaf         — The leaf value to prove membership for
 *   pathElements — Array of sibling hashes along the path
 *   pathIndices  — Array of 0/1 indicating leaf position at each level
 *   root         — Expected Merkle root (public input)
 *
 * Constraints: root === computedRoot
 */
template MerkleProof(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal input root;

    signal hashes[levels + 1];
    hashes[0] <== leaf;

    component hashers[levels];
    component mux[levels];

    for (var i = 0; i < levels; i++) {
        // Constrain pathIndices to be binary
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        // Select ordering: if pathIndex=0, leaf is left child; if 1, leaf is right
        mux[i] = MultiMux1(2);
        mux[i].c[0][0] <== hashes[i];
        mux[i].c[0][1] <== pathElements[i];
        mux[i].c[1][0] <== pathElements[i];
        mux[i].c[1][1] <== hashes[i];
        mux[i].s <== pathIndices[i];

        // Hash the pair
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i].out[0];
        hashers[i].inputs[1] <== mux[i].out[1];
        hashes[i + 1] <== hashers[i].out;
    }

    // Constrain computed root to match expected root
    root === hashes[levels];
}

/**
 * MerkleRoot(levels) — Computes a Merkle root from a leaf and proof path.
 *
 * Same as MerkleProof but outputs the computed root instead of constraining it.
 * Useful when you need to compute the root for comparison elsewhere.
 */
template MerkleRoot(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal output root;

    signal hashes[levels + 1];
    hashes[0] <== leaf;

    component hashers[levels];
    component mux[levels];

    for (var i = 0; i < levels; i++) {
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        mux[i] = MultiMux1(2);
        mux[i].c[0][0] <== hashes[i];
        mux[i].c[0][1] <== pathElements[i];
        mux[i].c[1][0] <== pathElements[i];
        mux[i].c[1][1] <== hashes[i];
        mux[i].s <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i].out[0];
        hashers[i].inputs[1] <== mux[i].out[1];
        hashes[i + 1] <== hashers[i].out;
    }

    root <== hashes[levels];
}
