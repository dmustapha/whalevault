"""Utilities for serializing Solana instructions for frontend consumption."""

import base64
import struct
from typing import Any

import httpx

from config import get_settings


# Instruction discriminators (first 8 bytes of sha256("global:<instruction_name>"))
# Anchor derives these automatically - must match program's instruction names
SHIELD_SOL_DISC = bytes([236, 230, 72, 63, 15, 240, 212, 155])  # sha256("global:shield_sol")[0:8]


def serialize_instruction(instruction: dict[str, Any]) -> dict[str, Any]:
    """
    Serialize a Solana instruction to JSON format for frontend.

    Args:
        instruction: Dict with programId, keys, and data (containing commitment, amount)

    Returns:
        Serialized instruction with base64-encoded binary data
    """
    data = instruction.get("data", {})

    # Build binary instruction data matching Veil program format:
    # discriminator (8 bytes) + commitment (32 bytes) + amount (u64, 8 bytes)
    commitment_hex = data.get("commitment", "")
    amount = data.get("amount", 0)

    # Convert commitment from hex to bytes (should be 32 bytes)
    commitment_bytes = bytes.fromhex(commitment_hex)
    if len(commitment_bytes) != 32:
        raise ValueError(f"Commitment must be 32 bytes, got {len(commitment_bytes)}")

    # Pack: discriminator + commitment + amount (little-endian u64)
    binary_data = SHIELD_SOL_DISC + commitment_bytes + struct.pack("<Q", amount)
    data_base64 = base64.b64encode(binary_data).decode()

    return {
        "programId": instruction["programId"],
        "keys": instruction["keys"],
        "data": data_base64,
    }


async def get_recent_blockhash() -> str:
    """
    Fetch recent blockhash from Solana RPC.

    Returns:
        Recent blockhash string

    Raises:
        httpx.HTTPError: If RPC request fails
        KeyError: If response format is unexpected
    """
    settings = get_settings()

    async with httpx.AsyncClient() as client:
        response = await client.post(
            settings.solana_rpc_url,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getLatestBlockhash",
                "params": [{"commitment": "finalized"}],
            },
            timeout=10.0,
        )
        response.raise_for_status()
        result = response.json()

        if "error" in result:
            raise ValueError(f"RPC error: {result['error']}")

        return result["result"]["value"]["blockhash"]
