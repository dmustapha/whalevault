"""
ZK Proof Generator Service

Generates Groth16 proofs by calling the Node.js snarkjs-based generator.
"""

import json
import subprocess
import os
from dataclasses import dataclass
from typing import List
from pathlib import Path

from utils.errors import VeilError


CIRCUITS_DIR = Path(__file__).parent.parent / "circuits"
GENERATOR_SCRIPT = CIRCUITS_DIR / "generate_proof.js"


@dataclass
class ZKProofResult:
    """Result of ZK proof generation."""
    proof_bytes: str  # 256-byte hex string for on-chain
    nullifier_hash: str
    public_inputs: dict


def generate_zk_proof(
    root: str,
    nullifier_hash: str,
    recipient: str,
    amount: int,
    secret: str,
    path_elements: List[str],
    path_indices: List[int],
) -> ZKProofResult:
    """
    Generate a Groth16 ZK proof for withdrawal.

    Args:
        root: Merkle root (hex)
        nullifier_hash: Expected nullifier hash (hex)
        recipient: Recipient address (hex, 32 bytes)
        amount: Amount in lamports
        secret: Secret used to create commitment (hex)
        path_elements: Merkle proof siblings (list of hex strings)
        path_indices: Path direction bits (list of 0/1)

    Returns:
        ZKProofResult with proof bytes and public inputs

    Raises:
        VeilError: If proof generation fails
    """
    # Prepare input for Node.js script
    input_data = {
        "root": root,
        "nullifierHash": nullifier_hash,
        "recipient": recipient,
        "amount": str(amount),
        "secret": secret,
        "pathElements": path_elements,
        "pathIndices": path_indices,
    }

    try:
        # Call Node.js proof generator
        result = subprocess.run(
            ["node", str(GENERATOR_SCRIPT)],
            input=json.dumps(input_data),
            capture_output=True,
            text=True,
            timeout=60,  # 60 second timeout for proof generation
            cwd=str(CIRCUITS_DIR),
        )

        if result.returncode != 0:
            error_msg = result.stderr or "Unknown error"
            raise VeilError(
                f"Proof generation failed: {error_msg}",
                details={"stderr": result.stderr, "stdout": result.stdout}
            )

        output = json.loads(result.stdout)

        return ZKProofResult(
            proof_bytes=output["proofBytes"],
            nullifier_hash=output["publicInputs"]["nullifierHash"],
            public_inputs=output["publicInputs"],
        )

    except subprocess.TimeoutExpired:
        raise VeilError("Proof generation timed out")
    except json.JSONDecodeError as e:
        raise VeilError(f"Invalid proof generator output: {e}")
    except FileNotFoundError:
        raise VeilError("Node.js not found. Please install Node.js.")


def compute_nullifier_hash(commitment: bytes, secret: bytes) -> bytes:
    """
    Compute nullifier hash using Poseidon.

    This should match the circuit: nullifier = Poseidon(commitment, secret)
    """
    from veil import _rust_core
    return _rust_core.poseidon_hash([commitment, secret])


def compute_commitment(amount: int, secret: bytes) -> bytes:
    """
    Compute commitment using Poseidon.

    This should match the circuit: commitment = Poseidon(amount, secret)
    """
    from veil import _rust_core
    amount_bytes = amount.to_bytes(32, byteorder='big')
    return _rust_core.poseidon_hash([amount_bytes, secret])
