/*
 * Poseidon Hash Re-export
 *
 * Re-exports the Poseidon hash from circomlib for use in our circuits.
 * Poseidon is a ZK-friendly hash function optimized for arithmetic circuits
 * over prime fields (BN128). It's ~8x cheaper in constraints than Pedersen.
 */

pragma circom 2.1.0;

include "node_modules/circomlib/circuits/poseidon.circom";
