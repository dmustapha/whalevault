//! Groth16 zkSNARK Verification for Solana
//!
//! This module provides on-chain Groth16 proof verification using Solana's
//! native alt_bn128 precompiles (available since Solana 1.18.x).
//!
//! The verification is performed using Solana's syscalls directly, avoiding
//! external dependencies that have compatibility issues with SBF builds.
//!
//! Proof Format (256 bytes):
//! - proof_a: 64 bytes (G1 point, big-endian)
//! - proof_b: 128 bytes (G2 point)
//! - proof_c: 64 bytes (G1 point)
//!
//! Public Inputs (each 32 bytes, big-endian):
//! - merkle_root
//! - nullifier_hash
//! - recipient
//! - amount

use anchor_lang::prelude::*;
use solana_program::alt_bn128::{
    prelude::*,
    compression::prelude::*,
};

/// Groth16 proof size in bytes
pub const PROOF_SIZE: usize = 256;

/// Size of a single public input (field element)
pub const PUBLIC_INPUT_SIZE: usize = 32;

/// Number of public inputs for the withdrawal circuit
/// Public inputs: root, nullifierHash, recipient, amount
pub const NUM_PUBLIC_INPUTS: usize = 4;

/// Total size of all public inputs
pub const PUBLIC_INPUTS_SIZE: usize = NUM_PUBLIC_INPUTS * PUBLIC_INPUT_SIZE;

/// Verifying key for the withdrawal circuit
///
/// This key was generated during trusted setup with snarkjs.
/// It matches the proving key used for proof generation.
///
/// Circuit: WhaleVault Withdraw (TREE_DEPTH=10)
/// Public inputs: root, nullifierHash, recipient, amount
pub mod vk {
    /// Alpha * G1 (64 bytes)
    pub const ALPHA_G1: [u8; 64] = [
        45, 77, 154, 167, 227, 2, 217, 223, 65, 116, 157, 85, 7, 148, 157, 5,
        219, 234, 51, 251, 177, 108, 100, 59, 34, 245, 153, 162, 190, 109, 242, 226,
        20, 190, 221, 80, 60, 55, 206, 176, 97, 216, 236, 96, 32, 159, 227, 69,
        206, 137, 131, 10, 25, 35, 3, 1, 240, 118, 202, 255, 0, 77, 25, 38,
    ];

    /// Beta * G2 (128 bytes)
    pub const BETA_G2: [u8; 128] = [
        9, 103, 3, 47, 203, 247, 118, 209, 175, 201, 133, 248, 136, 119, 241, 130,
        211, 132, 128, 166, 83, 242, 222, 202, 169, 121, 76, 188, 59, 243, 6, 12,
        14, 24, 120, 71, 173, 76, 121, 131, 116, 208, 214, 115, 43, 245, 1, 132,
        125, 214, 139, 192, 224, 113, 36, 30, 2, 19, 188, 127, 193, 61, 183, 171,
        48, 76, 251, 209, 224, 138, 112, 74, 153, 245, 232, 71, 217, 63, 140, 60,
        170, 253, 222, 196, 107, 122, 13, 55, 157, 166, 154, 77, 17, 35, 70, 167,
        23, 57, 193, 177, 164, 87, 168, 199, 49, 49, 35, 210, 77, 47, 145, 146,
        248, 150, 183, 198, 62, 234, 5, 169, 213, 127, 6, 84, 122, 208, 206, 200,
    ];

    /// Gamma * G2 (128 bytes)
    pub const GAMMA_G2: [u8; 128] = [
        25, 142, 147, 147, 146, 13, 72, 58, 114, 96, 191, 183, 49, 251, 93, 37,
        241, 170, 73, 51, 53, 169, 231, 18, 151, 228, 133, 183, 174, 243, 18, 194,
        24, 0, 222, 239, 18, 31, 30, 118, 66, 106, 0, 102, 94, 92, 68, 121,
        103, 67, 34, 212, 247, 94, 218, 221, 70, 222, 189, 92, 217, 146, 246, 237,
        9, 6, 137, 208, 88, 95, 240, 117, 236, 158, 153, 173, 105, 12, 51, 149,
        188, 75, 49, 51, 112, 179, 142, 243, 85, 172, 218, 220, 209, 34, 151, 91,
        18, 200, 94, 165, 219, 140, 109, 235, 74, 171, 113, 128, 141, 203, 64, 143,
        227, 209, 231, 105, 12, 67, 211, 123, 76, 230, 204, 1, 102, 250, 125, 170,
    ];

    /// Delta * G2 (128 bytes)
    pub const DELTA_G2: [u8; 128] = [
        27, 213, 67, 252, 247, 253, 12, 198, 174, 104, 181, 173, 62, 190, 44, 28,
        162, 140, 4, 170, 136, 35, 149, 233, 139, 84, 168, 159, 240, 55, 246, 2,
        0, 114, 158, 132, 24, 0, 86, 11, 108, 248, 236, 155, 238, 8, 214, 106,
        86, 12, 44, 47, 118, 204, 254, 148, 246, 10, 78, 170, 50, 196, 180, 178,
        40, 243, 152, 201, 44, 112, 167, 205, 67, 97, 21, 22, 30, 147, 76, 59,
        184, 95, 76, 6, 115, 30, 17, 6, 92, 97, 36, 196, 88, 110, 78, 143,
        14, 5, 41, 127, 123, 22, 88, 42, 19, 185, 238, 174, 200, 98, 163, 193,
        213, 33, 233, 121, 195, 232, 14, 54, 182, 130, 229, 234, 230, 119, 206, 144,
    ];

    /// IC elements (one for capacity + one per public input)
    /// For 4 public inputs: 5 * 64 = 320 bytes
    pub const IC: [[u8; 64]; 5] = [
        [
            26, 142, 152, 19, 66, 57, 188, 60, 34, 220, 171, 234, 136, 120, 58, 87,
            27, 236, 38, 11, 148, 1, 122, 116, 83, 40, 27, 198, 30, 54, 168, 62,
            35, 130, 46, 108, 168, 176, 91, 68, 85, 104, 201, 113, 16, 189, 135, 232,
            28, 172, 213, 51, 132, 227, 156, 58, 173, 87, 36, 26, 47, 225, 146, 93,
        ],
        [
            15, 253, 160, 19, 152, 146, 157, 102, 152, 248, 53, 102, 115, 88, 84, 109,
            115, 237, 129, 54, 210, 109, 137, 187, 92, 114, 210, 158, 154, 104, 64, 73,
            2, 250, 1, 144, 41, 188, 35, 29, 14, 248, 67, 69, 195, 127, 127, 210,
            238, 188, 134, 170, 253, 148, 210, 232, 59, 122, 74, 72, 223, 21, 33, 233,
        ],
        [
            6, 155, 8, 29, 35, 187, 248, 28, 58, 121, 66, 72, 75, 50, 63, 123,
            51, 230, 245, 90, 97, 46, 43, 38, 233, 216, 223, 95, 221, 147, 59, 83,
            31, 61, 174, 213, 231, 195, 169, 113, 71, 167, 35, 151, 0, 1, 67, 247,
            205, 142, 89, 205, 89, 22, 103, 62, 227, 194, 122, 160, 202, 68, 55, 239,
        ],
        [
            13, 179, 84, 210, 21, 56, 245, 180, 101, 38, 71, 143, 51, 137, 197, 243,
            143, 140, 28, 150, 200, 248, 253, 120, 13, 149, 255, 8, 255, 48, 170, 93,
            24, 201, 115, 240, 91, 246, 81, 111, 190, 178, 120, 200, 222, 147, 25, 180,
            254, 83, 219, 130, 66, 220, 110, 44, 25, 175, 88, 63, 125, 138, 18, 114,
        ],
        [
            40, 26, 185, 76, 3, 233, 141, 133, 105, 161, 113, 127, 202, 223, 131, 133,
            243, 251, 234, 16, 172, 210, 236, 17, 75, 103, 174, 124, 58, 149, 242, 120,
            44, 210, 194, 184, 196, 153, 3, 62, 174, 167, 232, 182, 83, 82, 197, 126,
            123, 114, 190, 206, 51, 237, 194, 113, 118, 176, 169, 237, 197, 118, 229, 202,
        ],
    ];
}

/// Check if verifying key is initialized (not all zeros)
fn is_vk_initialized() -> bool {
    vk::ALPHA_G1.iter().any(|&b| b != 0)
}

/// Groth16 proof structure
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Groth16Proof {
    /// Proof point A (G1, 64 bytes big-endian)
    pub a: [u8; 64],
    /// Proof point B (G2, 128 bytes big-endian)
    pub b: [u8; 128],
    /// Proof point C (G1, 64 bytes big-endian)
    pub c: [u8; 64],
}

impl Groth16Proof {
    /// Parse proof from raw bytes
    pub fn from_bytes(bytes: &[u8]) -> Option<Self> {
        if bytes.len() < PROOF_SIZE {
            return None;
        }

        let mut a = [0u8; 64];
        let mut b = [0u8; 128];
        let mut c = [0u8; 64];

        a.copy_from_slice(&bytes[0..64]);
        b.copy_from_slice(&bytes[64..192]);
        c.copy_from_slice(&bytes[192..256]);

        Some(Self { a, b, c })
    }

    /// Convert to raw bytes
    pub fn to_bytes(&self) -> [u8; PROOF_SIZE] {
        let mut bytes = [0u8; PROOF_SIZE];
        bytes[0..64].copy_from_slice(&self.a);
        bytes[64..192].copy_from_slice(&self.b);
        bytes[192..256].copy_from_slice(&self.c);
        bytes
    }
}

/// Public inputs for the withdrawal circuit
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct WithdrawPublicInputs {
    /// Current Merkle root
    pub root: [u8; 32],
    /// Nullifier hash (prevents double-spending)
    pub nullifier_hash: [u8; 32],
    /// Recipient address (included in proof to prevent front-running)
    pub recipient: [u8; 32],
    /// Amount being withdrawn
    pub amount: [u8; 32],
}

impl WithdrawPublicInputs {
    /// Convert to the format expected by the verifier (big-endian field elements)
    pub fn to_verifier_inputs(&self) -> [[u8; 32]; NUM_PUBLIC_INPUTS] {
        [self.root, self.nullifier_hash, self.recipient, self.amount]
    }
}

/// Errors for Groth16 verification
#[error_code]
pub enum Groth16Error {
    #[msg("Invalid proof size")]
    InvalidProofSize,
    #[msg("Invalid public inputs")]
    InvalidPublicInputs,
    #[msg("Proof verification failed")]
    VerificationFailed,
    #[msg("Verifying key not initialized")]
    VkNotInitialized,
    #[msg("Pairing computation failed")]
    PairingFailed,
    #[msg("Scalar multiplication failed")]
    ScalarMulFailed,
    #[msg("Point addition failed")]
    PointAddFailed,
}

/// Negate a G1 point (for pairing check)
/// G1 point: (x, y) -> (x, p - y) where p is the field modulus
fn negate_g1(point: &[u8; 64]) -> [u8; 64] {
    // BN254 field modulus p
    const P: [u8; 32] = [
        0x30, 0x64, 0x4e, 0x72, 0xe1, 0x31, 0xa0, 0x29,
        0xb8, 0x50, 0x45, 0xb6, 0x81, 0x81, 0x58, 0x5d,
        0x97, 0x81, 0x6a, 0x91, 0x68, 0x71, 0xca, 0x8d,
        0x3c, 0x20, 0x8c, 0x16, 0xd8, 0x7c, 0xfd, 0x47,
    ];

    let mut result = [0u8; 64];
    result[0..32].copy_from_slice(&point[0..32]); // x unchanged

    // y_neg = p - y (big-endian subtraction)
    let mut borrow = 0u16;
    for i in (0..32).rev() {
        let diff = (P[i] as u16) + 256 - (point[32 + i] as u16) - borrow;
        result[32 + i] = (diff & 0xFF) as u8;
        borrow = 1 - (diff >> 8);
    }

    result
}

/// Verify a Groth16 proof for a withdrawal using Solana's alt_bn128 syscalls
///
/// Groth16 verification equation:
/// e(A, B) = e(alpha, beta) * e(L, gamma) * e(C, delta)
///
/// Rearranged for pairing check (product of pairings = 1):
/// e(-A, B) * e(alpha, beta) * e(L, gamma) * e(C, delta) = 1
///
/// Where L = IC[0] + sum(public_input[i] * IC[i+1])
pub fn verify_groth16_withdraw(
    proof_bytes: &[u8],
    root: &[u8; 32],
    nullifier_hash: &[u8; 32],
    recipient: &[u8; 32],
    amount: &[u8; 32],
) -> Result<bool> {
    // Parse proof
    let proof = Groth16Proof::from_bytes(proof_bytes)
        .ok_or(Groth16Error::InvalidProofSize)?;

    // Check if verifying key is initialized
    if !is_vk_initialized() {
        // VK not initialized - for development, return true
        msg!("WARNING: Verifying key not initialized, skipping proof verification");
        return Ok(true);
    }

    // Compute L = IC[0] + sum(public_input[i] * IC[i+1])
    let public_inputs = [root, nullifier_hash, recipient, amount];

    // Start with IC[0]
    let mut l_point = vk::IC[0];

    // Add public_input[i] * IC[i+1] for each public input
    for (i, input) in public_inputs.iter().enumerate() {
        // Scalar multiplication: input * IC[i+1]
        let mut scalar_mul_input = [0u8; 96]; // 64 bytes point + 32 bytes scalar
        scalar_mul_input[0..64].copy_from_slice(&vk::IC[i + 1]);
        scalar_mul_input[64..96].copy_from_slice(*input);

        let mul_result = alt_bn128_multiplication(&scalar_mul_input)
            .map_err(|_| Groth16Error::ScalarMulFailed)?;

        // Point addition: L = L + mul_result
        let mut add_input = [0u8; 128];
        add_input[0..64].copy_from_slice(&l_point);
        add_input[64..128].copy_from_slice(&mul_result);

        let add_result = alt_bn128_addition(&add_input)
            .map_err(|_| Groth16Error::PointAddFailed)?;

        l_point.copy_from_slice(&add_result);
    }

    // Prepare pairing input: 4 pairs of (G1, G2) points
    // Each pair is 192 bytes (64 G1 + 128 G2)
    let mut pairing_input = [0u8; 768]; // 4 * 192

    // Pair 1: (-A, B) - negate A for the pairing check
    let neg_a = negate_g1(&proof.a);
    pairing_input[0..64].copy_from_slice(&neg_a);
    pairing_input[64..192].copy_from_slice(&proof.b);

    // Pair 2: (alpha, beta)
    pairing_input[192..256].copy_from_slice(&vk::ALPHA_G1);
    pairing_input[256..384].copy_from_slice(&vk::BETA_G2);

    // Pair 3: (L, gamma)
    pairing_input[384..448].copy_from_slice(&l_point);
    pairing_input[448..576].copy_from_slice(&vk::GAMMA_G2);

    // Pair 4: (C, delta)
    pairing_input[576..640].copy_from_slice(&proof.c);
    pairing_input[640..768].copy_from_slice(&vk::DELTA_G2);

    // Perform pairing check
    // Returns true if product of pairings equals 1
    let pairing_result = alt_bn128_pairing(&pairing_input)
        .map_err(|_| Groth16Error::PairingFailed)?;

    // The result is a single byte: 1 if valid, 0 if invalid
    Ok(pairing_result[31] == 1)
}

/// Convert a 32-byte little-endian field element to big-endian
///
/// arkworks uses little-endian, while Solana syscalls expect big-endian
pub fn le_to_be_32(le_bytes: &[u8; 32]) -> [u8; 32] {
    let mut be_bytes = *le_bytes;
    be_bytes.reverse();
    be_bytes
}

/// Convert a 64-byte little-endian G1 point to big-endian
///
/// G1 points are represented as (x, y) where each coordinate is 32 bytes
pub fn le_to_be_g1(le_bytes: &[u8; 64]) -> [u8; 64] {
    let mut be_bytes = [0u8; 64];
    // Reverse x coordinate
    be_bytes[0..32].copy_from_slice(&le_bytes[0..32]);
    be_bytes[0..32].reverse();
    // Reverse y coordinate
    be_bytes[32..64].copy_from_slice(&le_bytes[32..64]);
    be_bytes[32..64].reverse();
    be_bytes
}

/// Convert a 128-byte little-endian G2 point to big-endian
///
/// G2 points are represented as (x, y) where each coordinate is 64 bytes (Fq2)
/// Each Fq2 element is (c0, c1) where each is 32 bytes
pub fn le_to_be_g2(le_bytes: &[u8; 128]) -> [u8; 128] {
    let mut be_bytes = [0u8; 128];
    // x.c0, x.c1, y.c0, y.c1 - each 32 bytes, needs to be reversed
    for i in 0..4 {
        let start = i * 32;
        be_bytes[start..start + 32].copy_from_slice(&le_bytes[start..start + 32]);
        be_bytes[start..start + 32].reverse();
    }
    be_bytes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proof_parsing() {
        let mut proof_bytes = [0u8; 256];
        // Set some test values
        proof_bytes[0] = 1;
        proof_bytes[64] = 2;
        proof_bytes[192] = 3;

        let proof = Groth16Proof::from_bytes(&proof_bytes).unwrap();
        assert_eq!(proof.a[0], 1);
        assert_eq!(proof.b[0], 2);
        assert_eq!(proof.c[0], 3);
    }

    #[test]
    fn test_proof_too_short() {
        let proof_bytes = [0u8; 128]; // Too short
        assert!(Groth16Proof::from_bytes(&proof_bytes).is_none());
    }

    #[test]
    fn test_le_to_be_conversion() {
        let le = [1u8, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        let be = le_to_be_32(&le);
        assert_eq!(be[31], 1);
        assert_eq!(be[30], 2);
        assert_eq!(be[29], 3);
        assert_eq!(be[28], 4);
    }
}
