"""Tests to verify Veil SDK is properly installed and functional."""
import pytest


def test_veil_import():
    """Test that the veil package can be imported."""
    from veil import PrivacyClient, generate_secret
    assert PrivacyClient is not None
    assert generate_secret is not None


def test_rust_core_available():
    """Test that the Rust core module is available."""
    from veil import _rust_core
    assert hasattr(_rust_core, 'generate_commitment')
    assert hasattr(_rust_core, 'generate_nullifier')
    assert hasattr(_rust_core, 'generate_proof')
    assert hasattr(_rust_core, 'poseidon_hash')


def test_generate_secret():
    """Test secret generation."""
    from veil import generate_secret
    secret = generate_secret()
    assert isinstance(secret, str)
    assert len(secret) == 64  # 32 bytes as hex


def test_generate_commitment():
    """Test commitment generation using Rust core."""
    from veil import _rust_core, generate_secret
    from veil.utils import hex_to_bytes

    secret_hex = generate_secret()
    secret_bytes = hex_to_bytes(secret_hex)
    amount = 1_000_000_000  # 1 SOL in lamports

    commitment = _rust_core.generate_commitment(
        amount=amount,
        secret=secret_bytes
    )

    assert isinstance(commitment, bytes)
    assert len(commitment) == 32


def test_generate_nullifier():
    """Test nullifier generation using Rust core."""
    from veil import _rust_core, generate_secret
    from veil.utils import hex_to_bytes

    secret_hex = generate_secret()
    secret_bytes = hex_to_bytes(secret_hex)
    amount = 1_000_000_000

    # First generate commitment
    commitment = _rust_core.generate_commitment(
        amount=amount,
        secret=secret_bytes
    )

    # Then generate nullifier
    nullifier = _rust_core.generate_nullifier(
        commitment=commitment,
        secret=secret_bytes
    )

    assert isinstance(nullifier, bytes)
    assert len(nullifier) == 32


def test_commitment_deterministic():
    """Test that same inputs produce same commitment."""
    from veil import _rust_core

    secret = b"test_secret_32_bytes_exactly!!!!"  # 32 bytes
    amount = 500_000_000

    commitment1 = _rust_core.generate_commitment(amount=amount, secret=secret)
    commitment2 = _rust_core.generate_commitment(amount=amount, secret=secret)

    assert commitment1 == commitment2


def test_different_secrets_different_commitments():
    """Test that different secrets produce different commitments."""
    from veil import _rust_core, generate_secret
    from veil.utils import hex_to_bytes

    secret1 = hex_to_bytes(generate_secret())
    secret2 = hex_to_bytes(generate_secret())
    amount = 500_000_000

    commitment1 = _rust_core.generate_commitment(amount=amount, secret=secret1)
    commitment2 = _rust_core.generate_commitment(amount=amount, secret=secret2)

    assert commitment1 != commitment2


def test_poseidon_hash():
    """Test Poseidon hash function."""
    from veil import _rust_core

    # Hash some inputs
    inputs = [
        b"input1_padding_to_32_bytes_____",
        b"input2_padding_to_32_bytes_____",
    ]

    result = _rust_core.poseidon_hash(inputs)

    assert isinstance(result, bytes)
    assert len(result) == 32


def test_poseidon_hash_deterministic():
    """Test that Poseidon hash is deterministic."""
    from veil import _rust_core

    inputs = [
        b"same_input_padded_to_32_bytes__",
    ]

    hash1 = _rust_core.poseidon_hash(inputs)
    hash2 = _rust_core.poseidon_hash(inputs)

    assert hash1 == hash2
