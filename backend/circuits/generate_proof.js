#!/usr/bin/env node
/**
 * WhaleVault Proof Generator
 *
 * Generates Groth16 ZK proofs for privacy pool withdrawals.
 *
 * Usage: node generate_proof.js < input.json > output.json
 *
 * Input format:
 * {
 *   "root": "0x...",           // Merkle root (32 bytes hex)
 *   "nullifierHash": "0x...",  // Expected nullifier hash
 *   "recipient": "0x...",      // Recipient address (32 bytes)
 *   "amount": "1000000000",    // Amount in lamports as string
 *   "secret": "0x...",         // Secret (32 bytes hex)
 *   "pathElements": ["0x...", ...],  // Merkle proof siblings
 *   "pathIndices": [0, 1, ...]       // Path direction bits
 * }
 *
 * Output format:
 * {
 *   "proof": { "a": [...], "b": [...], "c": [...] },
 *   "publicInputs": ["root", "nullifierHash", "recipient", "amount"]
 * }
 */

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

const WASM_PATH = path.join(__dirname, 'withdraw_js', 'withdraw.wasm');
const ZKEY_PATH = path.join(__dirname, 'withdraw_final.zkey');
const VK_PATH = path.join(__dirname, '..', '..', 'circuits', 'build', 'verification_key.json');

function hexToDecimal(hex) {
    // Remove 0x prefix if present
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    return BigInt('0x' + cleanHex).toString();
}

function decimalToHex(decimal) {
    return '0x' + BigInt(decimal).toString(16).padStart(64, '0');
}

async function generateProof(input) {
    // Convert inputs to circuit format (decimal strings for field elements)
    const circuitInput = {
        root: hexToDecimal(input.root),
        nullifierHash: hexToDecimal(input.nullifierHash),
        recipient: hexToDecimal(input.recipient),
        amount: input.amount.toString(),
        secret: hexToDecimal(input.secret),
        pathElements: input.pathElements.map(hexToDecimal),
        pathIndices: input.pathIndices.map(x => x.toString()),
    };

    // Generate witness and proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        circuitInput,
        WASM_PATH,
        ZKEY_PATH
    );

    // Verify proof before returning (defense in depth)
    try {
        const vKey = JSON.parse(fs.readFileSync(VK_PATH, 'utf8'));
        const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        if (!isValid) {
            throw new Error('Generated proof failed self-verification');
        }
    } catch (e) {
        // If VK not available, skip verification (for development)
        if (!e.message.includes('ENOENT')) {
            throw e;
        }
    }

    // Format proof for Solana (256 bytes total)
    // proof.pi_a: G1 point (2 * 32 bytes = 64 bytes)
    // proof.pi_b: G2 point (2 * 2 * 32 bytes = 128 bytes)
    // proof.pi_c: G1 point (2 * 32 bytes = 64 bytes)

    const formatG1 = (point) => {
        return [
            decimalToHex(point[0]),
            decimalToHex(point[1]),
        ];
    };

    const formatG2 = (point) => {
        return [
            [decimalToHex(point[0][0]), decimalToHex(point[0][1])],
            [decimalToHex(point[1][0]), decimalToHex(point[1][1])],
        ];
    };

    return {
        proof: {
            a: formatG1(proof.pi_a),
            b: formatG2(proof.pi_b),
            c: formatG1(proof.pi_c),
        },
        publicInputs: {
            root: decimalToHex(publicSignals[0]),
            nullifierHash: decimalToHex(publicSignals[1]),
            recipient: decimalToHex(publicSignals[2]),
            amount: decimalToHex(publicSignals[3]),
        },
        // Raw proof bytes for on-chain verification (256 bytes)
        proofBytes: proofToBytes(proof),
    };
}

function proofToBytes(proof) {
    // Convert proof to 256-byte hex string for Solana
    // Format: [a (64)] [b (128)] [c (64)]
    let bytes = '';

    // pi_a: 2 * 32 bytes
    bytes += BigInt(proof.pi_a[0]).toString(16).padStart(64, '0');
    bytes += BigInt(proof.pi_a[1]).toString(16).padStart(64, '0');

    // pi_b: 2 * 2 * 32 bytes (note: reversed order for snarkjs)
    bytes += BigInt(proof.pi_b[0][1]).toString(16).padStart(64, '0');
    bytes += BigInt(proof.pi_b[0][0]).toString(16).padStart(64, '0');
    bytes += BigInt(proof.pi_b[1][1]).toString(16).padStart(64, '0');
    bytes += BigInt(proof.pi_b[1][0]).toString(16).padStart(64, '0');

    // pi_c: 2 * 32 bytes
    bytes += BigInt(proof.pi_c[0]).toString(16).padStart(64, '0');
    bytes += BigInt(proof.pi_c[1]).toString(16).padStart(64, '0');

    return '0x' + bytes;
}

// Read input from stdin
let inputData = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => inputData += chunk);
process.stdin.on('end', async () => {
    try {
        const input = JSON.parse(inputData);
        const result = await generateProof(input);
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(JSON.stringify({
            error: error.message,
            stack: error.stack
        }));
        process.exit(1);
    }
});
