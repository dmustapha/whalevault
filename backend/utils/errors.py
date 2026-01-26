"""Custom exception classes for the WhaleVault API."""

from typing import Any


class WhaleVaultError(Exception):
    """Base exception for WhaleVault API."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        details: dict[str, Any] | None = None,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class ValidationError(WhaleVaultError):
    """Raised when request validation fails."""

    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=400,
            details=details,
        )


class NotFoundError(WhaleVaultError):
    """Raised when a resource is not found."""

    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            code="NOT_FOUND",
            status_code=404,
            details=details,
        )


class VeilError(WhaleVaultError):
    """Raised when Veil SDK operations fail."""

    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            code="VEIL_ERROR",
            status_code=500,
            details=details,
        )


class RPCError(WhaleVaultError):
    """Raised when Solana RPC operations fail."""

    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            code="RPC_ERROR",
            status_code=502,
            details=details,
        )


class ProofError(WhaleVaultError):
    """Raised when proof generation fails."""

    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            code="PROOF_ERROR",
            status_code=500,
            details=details,
        )


class RelayerError(WhaleVaultError):
    """Raised when relayer operations fail."""

    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            code="RELAYER_ERROR",
            status_code=500,
            details=details,
        )
