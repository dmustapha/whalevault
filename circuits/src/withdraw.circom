pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "merkle.circom";

/*
 * WhaleVault Privacy Pool - Withdrawal Circuit
 *
 * This circuit proves:
 * 1. Knowledge of a secret that creates a valid commitment
 * 2. The commitment exists in the Merkle tree
 * 3. The nullifier is correctly derived (prevents double-spending)
 *
 * Public Inputs:
 *   - root: Current Merkle tree root
 *   - nullifierHash: Hash to prevent double-spending
 *   - recipient: Address receiving the funds
 *   - amount: Amount being withdrawn
 *
 * Private Inputs:
 *   - secret: User's secret (32 bytes as field element)
 *   - pathElements: Sibling hashes in Merkle path
 *   - pathIndices: Left/right indicators for path
 */

template Withdraw(levels) {
    // Public inputs
    signal input root;
    signal input nullifierHash;
    signal input recipient;
    signal input amount;

    // Private inputs
    signal input secret;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // Step 1: Compute commitment = Poseidon(amount, secret)
    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== amount;
    commitmentHasher.inputs[1] <== secret;
    signal commitment <== commitmentHasher.out;

    // Step 2: Compute nullifier = Poseidon(commitment, secret)
    // Using both commitment and secret ensures nullifier is unique per commitment
    // and can only be computed by the owner
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== commitment;
    nullifierHasher.inputs[1] <== secret;

    // Verify the nullifier matches the public input
    nullifierHasher.out === nullifierHash;

    // Step 3: Verify commitment exists in Merkle tree
    component merkleProof = MerkleTreeChecker(levels);
    merkleProof.leaf <== commitment;
    merkleProof.root <== root;
    for (var i = 0; i < levels; i++) {
        merkleProof.pathElements[i] <== pathElements[i];
        merkleProof.pathIndices[i] <== pathIndices[i];
    }

    // Note: recipient and amount are public inputs, so they're already bound
    // to the proof via the verification equation. No additional constraint needed.
}

// Main component with 10 levels (matches TREE_DEPTH in Rust)
component main {public [root, nullifierHash, recipient, amount]} = Withdraw(10);
