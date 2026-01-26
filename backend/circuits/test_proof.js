#!/usr/bin/env node
/**
 * Test proof generation with valid circuit inputs.
 *
 * This computes proper values that satisfy the circuit constraints.
 */

const snarkjs = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');
const path = require('path');

const WASM_PATH = path.join(__dirname, 'withdraw_js', 'withdraw.wasm');
const ZKEY_PATH = path.join(__dirname, 'withdraw_final.zkey');

async function main() {
    console.log('Building Poseidon hasher...');
    const poseidon = await buildPoseidon();

    // Test values
    const amount = BigInt(1000000000); // 1 SOL in lamports
    const secret = BigInt('0x' + '42'.repeat(32)); // Deterministic secret for testing

    // Compute commitment = Poseidon(amount, secret)
    const commitment = poseidon.F.toString(poseidon([amount, secret]));
    console.log('Commitment:', '0x' + BigInt(commitment).toString(16).padStart(64, '0'));

    // Compute nullifier = Poseidon(commitment, secret)
    const nullifier = poseidon.F.toString(poseidon([BigInt(commitment), secret]));
    console.log('Nullifier:', '0x' + BigInt(nullifier).toString(16).padStart(64, '0'));

    // For testing: use zero Merkle tree (all zeros for path elements)
    // This would be leaf index 0 in an empty tree
    const TREE_DEPTH = 10;
    const zeroHashes = [];
    let currentZero = BigInt(0);
    zeroHashes.push(currentZero.toString());
    for (let i = 1; i < TREE_DEPTH; i++) {
        currentZero = BigInt(poseidon.F.toString(poseidon([currentZero, currentZero])));
        zeroHashes.push(currentZero.toString());
    }

    // Compute the root for a tree with our commitment at index 0
    let currentHash = BigInt(commitment);
    for (let i = 0; i < TREE_DEPTH; i++) {
        const sibling = BigInt(zeroHashes[i]);
        // pathIndex 0 means leaf is on left, so we hash(leaf, sibling)
        currentHash = BigInt(poseidon.F.toString(poseidon([currentHash, sibling])));
    }
    const root = currentHash.toString();
    console.log('Root:', '0x' + BigInt(root).toString(16).padStart(64, '0'));

    // Recipient (arbitrary test address)
    const recipient = BigInt('0x' + '11'.repeat(32));

    // Circuit inputs
    const input = {
        root: root,
        nullifierHash: nullifier,
        recipient: recipient.toString(),
        amount: amount.toString(),
        secret: secret.toString(),
        pathElements: zeroHashes.slice(0, TREE_DEPTH),
        pathIndices: Array(TREE_DEPTH).fill('0'),
    };

    console.log('\nGenerating proof...');
    console.log('Input:', JSON.stringify(input, null, 2));

    try {
        const startTime = Date.now();
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input,
            WASM_PATH,
            ZKEY_PATH
        );
        const endTime = Date.now();

        console.log('\n✅ Proof generated successfully!');
        console.log('Time:', (endTime - startTime) / 1000, 'seconds');
        console.log('\nPublic signals:', publicSignals);

        // Verify the proof
        const vkeyJson = require(path.join(__dirname, '..', '..', 'circuits', 'build', 'verification_key.json'));
        const isValid = await snarkjs.groth16.verify(vkeyJson, publicSignals, proof);
        console.log('Proof valid:', isValid);

        if (isValid) {
            console.log('\n🎉 End-to-end ZK proof test PASSED!');
        } else {
            console.log('\n❌ Proof verification failed');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

main();
