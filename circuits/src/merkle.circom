pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/poseidon.circom";

/*
 * Merkle Tree Proof Verifier
 *
 * Verifies that a leaf exists in a Merkle tree with the given root.
 * Uses Poseidon hash for compatibility with on-chain implementation.
 */

// Selects between two inputs based on selector bit
template DualMux() {
    signal input in[2];
    signal input s;
    signal output out[2];

    s * (1 - s) === 0;  // s must be 0 or 1
    out[0] <== (in[1] - in[0]) * s + in[0];
    out[1] <== (in[0] - in[1]) * s + in[1];
}

// Computes hash of two nodes, ordering based on selector
template HashLeftRight() {
    signal input left;
    signal input right;
    signal output hash;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== left;
    hasher.inputs[1] <== right;
    hash <== hasher.out;
}

/*
 * MerkleTreeChecker
 *
 * Verifies a Merkle proof for the given leaf.
 *
 * Inputs:
 *   - leaf: The leaf value to verify
 *   - root: Expected Merkle root
 *   - pathElements: Sibling hashes along the path
 *   - pathIndices: 0 = leaf is left child, 1 = leaf is right child
 */
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    component selectors[levels];
    component hashers[levels];

    signal levelHashes[levels + 1];
    levelHashes[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        // Select ordering based on path index
        selectors[i] = DualMux();
        selectors[i].in[0] <== levelHashes[i];
        selectors[i].in[1] <== pathElements[i];
        selectors[i].s <== pathIndices[i];

        // Hash the pair
        hashers[i] = HashLeftRight();
        hashers[i].left <== selectors[i].out[0];
        hashers[i].right <== selectors[i].out[1];

        levelHashes[i + 1] <== hashers[i].hash;
    }

    // Final hash must equal the root
    root === levelHashes[levels];
}
