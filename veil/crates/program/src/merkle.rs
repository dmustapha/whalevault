//! Incremental Merkle Tree Implementation
//!
//! This module implements an incremental Merkle tree for storing commitments.
//! The tree uses SHA256 for hashing (simpler than Poseidon for MVP).
//!
//! Tree Structure:
//! - Depth: 20 levels (supports ~1 million leaves)
//! - Leaves are commitments (32 bytes each)
//! - Uses "filled subtrees" optimization for O(log n) insertions

use anchor_lang::prelude::*;
use solana_program::keccak;

/// Merkle tree depth (10 levels = 2^10 = 1,024 leaves)
/// Reduced from 20 to avoid stack overflow on Solana
pub const TREE_DEPTH: usize = 10;

/// Zero value for empty leaves (hash of empty bytes)
pub const ZERO_VALUE: [u8; 32] = [
    0x29, 0x0d, 0xec, 0xd9, 0x54, 0x8b, 0x62, 0xa8,
    0xd6, 0x03, 0x45, 0xa9, 0x88, 0x38, 0x6f, 0xc8,
    0x4b, 0xa6, 0xbc, 0x95, 0x48, 0x40, 0x08, 0xf6,
    0x36, 0x2f, 0x93, 0x16, 0x0e, 0xf3, 0xe5, 0x63,
];

/// Precomputed zero hashes for each level (Keccak256)
/// zeros[i] = keccak256(zeros[i-1] || zeros[i-1])
/// Precomputed to eliminate stack allocation in get_zero_hash()
pub const ZERO_HASHES: [[u8; 32]; TREE_DEPTH + 1] = [
    // Level 0
    [0x29, 0x0d, 0xec, 0xd9, 0x54, 0x8b, 0x62, 0xa8,
     0xd6, 0x03, 0x45, 0xa9, 0x88, 0x38, 0x6f, 0xc8,
     0x4b, 0xa6, 0xbc, 0x95, 0x48, 0x40, 0x08, 0xf6,
     0x36, 0x2f, 0x93, 0x16, 0x0e, 0xf3, 0xe5, 0x63],
    // Level 1
    [0x63, 0x3d, 0xc4, 0xd7, 0xda, 0x72, 0x56, 0x66,
     0x0a, 0x89, 0x2f, 0x8f, 0x16, 0x04, 0xa4, 0x4b,
     0x54, 0x32, 0x64, 0x9c, 0xc8, 0xec, 0x5c, 0xb3,
     0xce, 0xd4, 0xc4, 0xe6, 0xac, 0x94, 0xdd, 0x1d],
    // Level 2
    [0x89, 0x07, 0x40, 0xa8, 0xeb, 0x06, 0xce, 0x9b,
     0xe4, 0x22, 0xcb, 0x8d, 0xa5, 0xcd, 0xaf, 0xc2,
     0xb5, 0x8c, 0x0a, 0x5e, 0x24, 0x03, 0x6c, 0x57,
     0x8d, 0xe2, 0xa4, 0x33, 0xc8, 0x28, 0xff, 0x7d],
    // Level 3
    [0x3b, 0x8e, 0xc0, 0x9e, 0x02, 0x6f, 0xdc, 0x30,
     0x53, 0x65, 0xdf, 0xc9, 0x4e, 0x18, 0x9a, 0x81,
     0xb3, 0x8c, 0x75, 0x97, 0xb3, 0xd9, 0x41, 0xc2,
     0x79, 0xf0, 0x42, 0xe8, 0x20, 0x6e, 0x0b, 0xd8],
    // Level 4
    [0xec, 0xd5, 0x0e, 0xee, 0x38, 0xe3, 0x86, 0xbd,
     0x62, 0xbe, 0x9b, 0xed, 0xb9, 0x90, 0x70, 0x69,
     0x51, 0xb6, 0x5f, 0xe0, 0x53, 0xbd, 0x9d, 0x8a,
     0x52, 0x1a, 0xf7, 0x53, 0xd1, 0x39, 0xe2, 0xda],
    // Level 5
    [0xde, 0xff, 0xf6, 0xd3, 0x30, 0xbb, 0x54, 0x03,
     0xf6, 0x3b, 0x14, 0xf3, 0x3b, 0x57, 0x82, 0x74,
     0x16, 0x0d, 0xe3, 0xa5, 0x0d, 0xf4, 0xef, 0xec,
     0xf0, 0xe0, 0xdb, 0x73, 0xbc, 0xdd, 0x3d, 0xa5],
    // Level 6
    [0x61, 0x7b, 0xdd, 0x11, 0xf7, 0xc0, 0xa1, 0x1f,
     0x49, 0xdb, 0x22, 0xf6, 0x29, 0x38, 0x7a, 0x12,
     0xda, 0x75, 0x96, 0xf9, 0xd1, 0x70, 0x4d, 0x74,
     0x65, 0x17, 0x7c, 0x63, 0xd8, 0x8e, 0xc7, 0xd7],
    // Level 7
    [0x29, 0x2c, 0x23, 0xa9, 0xaa, 0x1d, 0x8b, 0xea,
     0x7e, 0x24, 0x35, 0xe5, 0x55, 0xa4, 0xa6, 0x0e,
     0x37, 0x9a, 0x5a, 0x35, 0xf3, 0xf4, 0x52, 0xba,
     0xe6, 0x01, 0x21, 0x07, 0x3f, 0xb6, 0xee, 0xad],
    // Level 8
    [0xe1, 0xce, 0xa9, 0x2e, 0xd9, 0x9a, 0xcd, 0xcb,
     0x04, 0x5a, 0x67, 0x26, 0xb2, 0xf8, 0x71, 0x07,
     0xe8, 0xa6, 0x16, 0x20, 0xa2, 0x32, 0xcf, 0x4d,
     0x7d, 0x5b, 0x57, 0x66, 0xb3, 0x95, 0x2e, 0x10],
    // Level 9
    [0x7a, 0xd6, 0x6c, 0x0a, 0x68, 0xc7, 0x2c, 0xb8,
     0x9e, 0x4f, 0xb4, 0x30, 0x38, 0x41, 0x96, 0x6e,
     0x40, 0x62, 0xa7, 0x6a, 0xb9, 0x74, 0x51, 0xe3,
     0xb9, 0xfb, 0x52, 0x6a, 0x5c, 0xeb, 0x7f, 0x82],
    // Level 10
    [0xe0, 0x26, 0xcc, 0x5a, 0x4a, 0xed, 0x3c, 0x22,
     0xa5, 0x8c, 0xbd, 0x3d, 0x2a, 0xc7, 0x54, 0xc9,
     0x35, 0x2c, 0x54, 0x36, 0xf6, 0x38, 0x04, 0x2d,
     0xca, 0x99, 0x03, 0x4e, 0x83, 0x63, 0x65, 0x16],
];

/// Get zero hash for a specific level (O(1) lookup, no stack allocation)
#[inline]
pub fn get_zero_hash(level: usize) -> [u8; 32] {
    ZERO_HASHES[level]
}

/// Hash two 32-byte values together using Keccak256
/// Note: Using Keccak256 for Solana compatibility (cheaper than SHA256 on-chain)
pub fn hash_pair(left: &[u8; 32], right: &[u8; 32]) -> [u8; 32] {
    let mut combined = [0u8; 64];
    combined[..32].copy_from_slice(left);
    combined[32..].copy_from_slice(right);

    keccak::hash(&combined).to_bytes()
}

/// Incremental Merkle Tree state
///
/// This stores the minimal state needed to:
/// 1. Insert new leaves efficiently
/// 2. Compute the current root
/// 3. Generate membership proofs
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct IncrementalMerkleTree {
    /// Current number of leaves in the tree
    pub next_index: u64,

    /// Filled subtrees - stores the rightmost node at each level
    /// that has been "filled" (both children are non-zero)
    pub filled_subtrees: [[u8; 32]; TREE_DEPTH],

    /// Current root of the tree
    pub current_root: [u8; 32],
}

impl Default for IncrementalMerkleTree {
    fn default() -> Self {
        Self::new()
    }
}

impl IncrementalMerkleTree {
    /// Size of the tree state in bytes
    pub const SIZE: usize = 8 + (32 * TREE_DEPTH) + 32; // next_index + filled_subtrees + current_root

    /// Maximum number of leaves
    pub const MAX_LEAVES: u64 = 1 << TREE_DEPTH; // 2^20 = 1,048,576

    /// Create a new empty tree
    pub fn new() -> Self {
        let mut filled_subtrees = [[0u8; 32]; TREE_DEPTH];

        // Initialize filled_subtrees with zero hashes
        for i in 0..TREE_DEPTH {
            filled_subtrees[i] = get_zero_hash(i);
        }

        // Initial root is the zero hash at the top level
        let current_root = get_zero_hash(TREE_DEPTH);

        Self {
            next_index: 0,
            filled_subtrees,
            current_root,
        }
    }

    /// Insert a new leaf into the tree
    ///
    /// Returns the index of the inserted leaf
    pub fn insert(&mut self, leaf: [u8; 32]) -> Result<u64> {
        require!(
            self.next_index < Self::MAX_LEAVES,
            MerkleError::TreeFull
        );

        let leaf_index = self.next_index;
        let mut current_hash = leaf;
        let mut current_index = leaf_index;

        // Walk up the tree, computing hashes
        for level in 0..TREE_DEPTH {
            let is_left = current_index % 2 == 0;

            if is_left {
                // We're on the left side - use zero hash for right sibling
                let right = get_zero_hash(level);

                // Store this node as the filled subtree at this level
                self.filled_subtrees[level] = current_hash;

                current_hash = hash_pair(&current_hash, &right);
            } else {
                // We're on the right side - use filled subtree for left sibling
                let left = self.filled_subtrees[level];
                current_hash = hash_pair(&left, &current_hash);
            }

            current_index /= 2;
        }

        // Update the root
        self.current_root = current_hash;
        self.next_index += 1;

        Ok(leaf_index)
    }

    /// Get the current root
    pub fn root(&self) -> [u8; 32] {
        self.current_root
    }

    /// Check if a root is valid (matches current root)
    /// In production, we'd also check against a history of recent roots
    pub fn is_known_root(&self, root: &[u8; 32]) -> bool {
        *root == self.current_root
    }
}

/// Verify a Merkle proof
///
/// # Arguments
/// * `leaf` - The leaf value being proven
/// * `leaf_index` - The index of the leaf in the tree
/// * `siblings` - Array of sibling hashes from leaf to root
/// * `root` - The expected root
///
/// # Returns
/// True if the proof is valid
pub fn verify_merkle_proof(
    leaf: &[u8; 32],
    leaf_index: u64,
    siblings: &[[u8; 32]; TREE_DEPTH],
    root: &[u8; 32],
) -> bool {
    let mut current_hash = *leaf;
    let mut current_index = leaf_index;

    for level in 0..TREE_DEPTH {
        let sibling = &siblings[level];
        let is_left = current_index % 2 == 0;

        current_hash = if is_left {
            hash_pair(&current_hash, sibling)
        } else {
            hash_pair(sibling, &current_hash)
        };

        current_index /= 2;
    }

    current_hash == *root
}

/// Generate a Merkle proof for a leaf
///
/// Note: This requires knowing all leaves, so it's typically done client-side.
/// The on-chain program only needs to verify proofs, not generate them.
pub fn generate_merkle_proof(
    leaves: &[[u8; 32]],
    leaf_index: usize,
) -> Option<[[u8; 32]; TREE_DEPTH]> {
    if leaf_index >= leaves.len() {
        return None;
    }

    let mut proof = [[0u8; 32]; TREE_DEPTH];
    let mut level_nodes: Vec<[u8; 32]> = leaves.to_vec();

    // Pad to power of 2
    let tree_size = 1 << TREE_DEPTH;
    while level_nodes.len() < tree_size {
        level_nodes.push(get_zero_hash(0));
    }

    let mut current_index = leaf_index;

    for level in 0..TREE_DEPTH {
        // Get sibling index
        let sibling_index = if current_index % 2 == 0 {
            current_index + 1
        } else {
            current_index - 1
        };

        proof[level] = level_nodes[sibling_index];

        // Compute next level
        let mut next_level = Vec::new();
        for i in (0..level_nodes.len()).step_by(2) {
            let left = &level_nodes[i];
            let right = &level_nodes[i + 1];
            next_level.push(hash_pair(left, right));
        }

        level_nodes = next_level;
        current_index /= 2;
    }

    Some(proof)
}

/// Custom errors for Merkle tree operations
#[error_code]
pub enum MerkleError {
    #[msg("Merkle tree is full")]
    TreeFull,
    #[msg("Invalid Merkle proof")]
    InvalidProof,
    #[msg("Invalid leaf index")]
    InvalidLeafIndex,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_zero_hashes_for_depth_10() {
        // Compute zero hashes for TREE_DEPTH = 10
        let mut zeros = [[0u8; 32]; 11];
        zeros[0] = ZERO_VALUE;

        for i in 1..=10 {
            zeros[i] = hash_pair(&zeros[i - 1], &zeros[i - 1]);
        }

        println!("\n// Precomputed ZERO_HASHES for TREE_DEPTH = 10");
        println!("pub const ZERO_HASHES: [[u8; 32]; 11] = [");
        for (level, z) in zeros.iter().enumerate() {
            print!("    // Level {}\n    [", level);
            for (j, b) in z.iter().enumerate() {
                if j > 0 { print!(", "); }
                if j % 8 == 0 && j > 0 { print!("\n     "); }
                print!("0x{:02x}", b);
            }
            println!("],");
        }
        println!("];");
    }

    #[test]
    fn test_empty_tree_root() {
        let tree = IncrementalMerkleTree::new();
        let expected_root = get_zero_hash(TREE_DEPTH);
        assert_eq!(tree.root(), expected_root);
    }

    #[test]
    fn test_insert_single_leaf() {
        let mut tree = IncrementalMerkleTree::new();
        let leaf = [1u8; 32];

        let index = tree.insert(leaf).unwrap();
        assert_eq!(index, 0);
        assert_eq!(tree.next_index, 1);

        // Root should have changed
        assert_ne!(tree.root(), get_zero_hash(TREE_DEPTH));
    }

    #[test]
    fn test_insert_two_leaves() {
        let mut tree = IncrementalMerkleTree::new();
        let leaf1 = [1u8; 32];
        let leaf2 = [2u8; 32];

        tree.insert(leaf1).unwrap();
        let root_after_one = tree.root();

        tree.insert(leaf2).unwrap();
        let root_after_two = tree.root();

        // Roots should be different
        assert_ne!(root_after_one, root_after_two);
    }

    #[test]
    fn test_deterministic_root() {
        let mut tree1 = IncrementalMerkleTree::new();
        let mut tree2 = IncrementalMerkleTree::new();

        let leaf = [42u8; 32];

        tree1.insert(leaf).unwrap();
        tree2.insert(leaf).unwrap();

        assert_eq!(tree1.root(), tree2.root());
    }

    #[test]
    fn test_verify_proof() {
        let leaves: Vec<[u8; 32]> = (0..4)
            .map(|i| {
                let mut leaf = [0u8; 32];
                leaf[0] = i as u8;
                leaf
            })
            .collect();

        // Build tree
        let mut tree = IncrementalMerkleTree::new();
        for leaf in &leaves {
            tree.insert(*leaf).unwrap();
        }

        // Generate and verify proof for leaf 0
        if let Some(proof) = generate_merkle_proof(&leaves, 0) {
            let valid = verify_merkle_proof(&leaves[0], 0, &proof, &tree.root());
            assert!(valid);
        }
    }
}
