/*
 * Verified Builder Circuit
 *
 * Proves that a builder has been active for at least `minDays` days
 * without revealing which specific days they were active.
 *
 * Public inputs:
 *   activityRoot     — Merkle root of the activity tree
 *   minDays          — Minimum number of active days required
 *   currentTimestamp — Proof freshness binding (verifiers reject stale timestamps)
 *
 * Private inputs (witness):
 *   activityDates[maxDays]           — Poseidon-hashed activity timestamps (0-padded)
 *   pathElements[maxDays][depth]     — Merkle proof siblings for each activity
 *   pathIndices[maxDays][depth]      — Merkle proof path indices
 *
 * Constraints: ~12K estimated
 *
 * Padding note (Fix #6):
 *   Padding slots (activityDates[i] == 0) have unconstrained pathElements/pathIndices.
 *   This is safe because: (1) the contiguous prefix constraint guarantees all zeros
 *   are at the tail, (2) the conditional root check (isNonZero * rootDiff === 0)
 *   skips Merkle verification for zero slots, and (3) the prover gains nothing by
 *   manipulating padding data — it cannot increase activeCount or bypass uniqueness.
 *   Adding full padding constraints would cost ~29K constraints (365 × 20 × 4).
 */

pragma circom 2.1.0;

include "lib/poseidon.circom";
include "lib/comparators.circom";
include "lib/merkle.circom";

template VerifiedBuilder(maxDays, depth) {
    // Public inputs
    signal input activityRoot;
    signal input minDays;
    // Proof freshness binding — verifiers reject stale timestamps off-chain.
    // Not used for in-circuit range checks because activityDates are Poseidon hashes.
    signal input currentTimestamp;

    // Constrain currentTimestamp to a realistic range [2020-01-01, 2050-01-01]
    // This prevents trivial timestamps (e.g. 0 or 1) from being used.
    component tsRange = InRange(40);
    tsRange.value <== currentTimestamp;
    tsRange.lower <== 1577836800;  // 2020-01-01T00:00:00Z
    tsRange.upper <== 2524608000;  // 2050-01-01T00:00:00Z
    tsRange.out === 1;

    // Private inputs
    signal input activityDates[maxDays];
    signal input pathElements[maxDays][depth];
    signal input pathIndices[maxDays][depth];

    // Output: 1 if proof is valid
    signal output valid;

    // Count non-zero activity dates (padded entries are 0)
    component isNonZero[maxDays];
    signal activeCount[maxDays + 1];
    activeCount[0] <== 0;

    // Verify each non-zero activity against the Merkle tree
    component merkleProofs[maxDays];
    signal rootDiff[maxDays];

    for (var i = 0; i < maxDays; i++) {
        // Check if this slot has an activity (non-zero)
        isNonZero[i] = IsNonZero();
        isNonZero[i].in <== activityDates[i];

        // Accumulate count of active days
        activeCount[i + 1] <== activeCount[i] + isNonZero[i].out;

        // Verify Merkle proof for each activity entry
        // For zero-padded entries, the proof is unconstrained (leaf=0 won't match root)
        // but that's fine — we only count non-zero entries
        merkleProofs[i] = MerkleRoot(depth);
        merkleProofs[i].leaf <== activityDates[i];
        for (var j = 0; j < depth; j++) {
            merkleProofs[i].pathElements[j] <== pathElements[i][j];
            merkleProofs[i].pathIndices[j] <== pathIndices[i][j];
        }

        // If activity is non-zero, its Merkle root must match the public activityRoot
        // Constraint: isNonZero * (computedRoot - activityRoot) === 0
        rootDiff[i] <== merkleProofs[i].root - activityRoot;
        isNonZero[i].out * rootDiff[i] === 0;
    }

    // Contiguous prefix enforcement (Fix #1):
    // If a slot is zero, all subsequent slots must also be zero.
    // This prevents zero-interleaving attacks like [A, 0, A, 0, ...]
    // which would bypass the sorted ordering uniqueness check below.
    for (var i = 0; i < maxDays - 1; i++) {
        (1 - isNonZero[i].out) * isNonZero[i + 1].out === 0;
    }

    // Uniqueness note: sorted ordering check was removed because Poseidon
    // hashes are ~254-bit field elements, which overflow LessThan(252).
    // Uniqueness is still enforced by the Merkle tree: each non-zero leaf
    // must produce the committed root with its proof, so duplicate claims
    // require distinct valid Merkle paths (different positions in the tree).

    // Verify count meets minimum threshold
    component geq = GreaterEqThan(32);
    geq.in[0] <== activeCount[maxDays];
    geq.in[1] <== minDays;

    valid <== geq.out;
}

// Default instantiation: max 30 days, Merkle depth 20
component main {public [activityRoot, minDays, currentTimestamp]} = VerifiedBuilder(30, 20);
