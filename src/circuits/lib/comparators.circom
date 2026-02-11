/*
 * Comparator Templates
 *
 * Provides comparison operations for circuit signals.
 * All comparisons operate on n-bit unsigned integers.
 */

pragma circom 2.1.0;

include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/bitify.circom";

// GreaterEqThan is provided by circomlib (included above) — no custom version needed.

/**
 * InRange(n) — Checks if value is within [lower, upper] inclusive.
 * Output: 1 if lower <= value <= upper, 0 otherwise.
 */
template InRange(n) {
    signal input value;
    signal input lower;
    signal input upper;
    signal output out;

    component geqLower = GreaterEqThan(n);
    geqLower.in[0] <== value;
    geqLower.in[1] <== lower;

    component leqUpper = GreaterEqThan(n);
    leqUpper.in[0] <== upper;
    leqUpper.in[1] <== value;

    out <== geqLower.out * leqUpper.out;
}

/**
 * IsNonZero() — Checks if the input is non-zero.
 * Output: 1 if in != 0, 0 if in == 0.
 */
template IsNonZero() {
    signal input in;
    signal output out;

    component isz = IsZero();
    isz.in <== in;
    out <== 1 - isz.out;
}
