from pydantic import BaseModel, Field


# Maximum shield/unshield amount: 1000 SOL in lamports
# This prevents absurd values and potential overflow issues
MAX_AMOUNT_LAMPORTS = 1_000_000_000_000  # 1000 SOL

# Minimum amount: 0.001 SOL (to cover transaction fees)
MIN_AMOUNT_LAMPORTS = 1_000_000  # 0.001 SOL


class ShieldPrepareRequest(BaseModel):
    """Request to prepare a shield (deposit) transaction."""

    amount: int = Field(
        ...,
        gt=MIN_AMOUNT_LAMPORTS,
        le=MAX_AMOUNT_LAMPORTS,
        description=f"Amount in lamports to shield (min: {MIN_AMOUNT_LAMPORTS}, max: {MAX_AMOUNT_LAMPORTS})",
    )
    depositor: str = Field(
        ...,
        min_length=32,
        max_length=44,
        description="Depositor's Solana public key",
    )
    commitment: str | None = Field(
        None,
        min_length=64,
        max_length=64,
        description="Pre-computed commitment from frontend (64 hex characters). If provided, backend won't generate secret.",
    )


class UnshieldProofRequest(BaseModel):
    """Request to generate an unshield (withdrawal) proof."""

    commitment: str = Field(
        ...,
        min_length=64,
        max_length=64,
        description="The commitment hash from the deposit (64 hex characters)",
    )
    secret: str = Field(
        ...,
        min_length=64,
        max_length=64,
        description="The secret used to generate the commitment (64 hex characters)",
    )
    amount: int = Field(
        ...,
        gt=MIN_AMOUNT_LAMPORTS,
        le=MAX_AMOUNT_LAMPORTS,
        description=f"Amount in lamports to unshield (min: {MIN_AMOUNT_LAMPORTS}, max: {MAX_AMOUNT_LAMPORTS})",
    )
    recipient: str = Field(
        ...,
        min_length=32,
        max_length=44,
        description="Recipient's Solana public key",
    )


class UnshieldPrepareRequest(BaseModel):
    """Request to prepare an unshield transaction after proof generation."""

    job_id: str = Field(
        ...,
        description="The proof job ID from the /unshield/proof endpoint",
    )
    recipient: str | None = Field(
        None,
        min_length=32,
        max_length=44,
        description="Override recipient address (defaults to original proof recipient)",
    )
    relayer: str = Field(
        ...,
        min_length=32,
        max_length=44,
        description="The relayer/signer wallet address (usually the user's connected wallet)",
    )


class RelayUnshieldRequest(BaseModel):
    """Request to relay an unshield transaction through the relayer."""

    job_id: str = Field(
        ...,
        description="The proof job ID from the /unshield/proof endpoint",
    )
    recipient: str = Field(
        ...,
        min_length=32,
        max_length=44,
        description="Recipient Solana address to receive the funds",
    )


class ComputeCommitmentRequest(BaseModel):
    """Request to compute a commitment from amount and secret."""

    amount: int = Field(
        ...,
        gt=MIN_AMOUNT_LAMPORTS,
        le=MAX_AMOUNT_LAMPORTS,
        description=f"Amount in lamports (min: {MIN_AMOUNT_LAMPORTS}, max: {MAX_AMOUNT_LAMPORTS})",
    )
    secret: str = Field(
        ...,
        min_length=64,
        max_length=64,
        description="The secret used to generate the commitment (64 hex characters)",
    )
