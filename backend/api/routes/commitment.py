"""
Commitment computation endpoint.

This endpoint allows the frontend to compute commitments from amount and secret
without storing any state. This is needed for the deterministic secret derivation
flow where the frontend derives secrets from wallet signatures.
"""

from fastapi import APIRouter

from models.requests import ComputeCommitmentRequest
from models.responses import ComputeCommitmentResponse
from veil import _rust_core
from veil.utils import hex_to_bytes

router = APIRouter()


@router.post("/compute", response_model=ComputeCommitmentResponse)
async def compute_commitment(
    request: ComputeCommitmentRequest,
) -> ComputeCommitmentResponse:
    """
    Compute a commitment from amount and secret.

    This is a stateless operation - no data is stored.
    Used by frontend to compute commitment after deriving secret from wallet signature.

    The commitment is computed as: Poseidon(amount, secret)
    """
    # Convert hex secret to bytes
    secret_bytes = hex_to_bytes(request.secret)

    # Compute commitment using Veil SDK
    commitment_bytes = _rust_core.generate_commitment(
        amount=request.amount,
        secret=secret_bytes
    )

    return ComputeCommitmentResponse(
        commitment=commitment_bytes.hex()
    )
