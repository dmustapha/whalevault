pragma circom 2.1.6;

/*
 * Poseidon Hash - Using circomlib's implementation
 *
 * We re-export circomlib's Poseidon for use in our circuits.
 * This is battle-tested and optimized for BN254.
 */

include "../node_modules/circomlib/circuits/poseidon.circom";
