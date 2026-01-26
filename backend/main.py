from contextlib import asynccontextmanager
from typing import AsyncGenerator
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from config import get_settings
from api.routes import api_router
from utils.errors import WhaleVaultError
from middleware import CSRFMiddleware

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager for startup and shutdown events."""
    settings = get_settings()

    # Startup
    print(f"Starting WhaleVault API...")
    print(f"  RPC: {settings.solana_rpc_url}")
    print(f"  Program: {settings.program_id}")
    print(f"  Debug: {settings.debug}")

    yield

    # Shutdown
    print("Shutting down WhaleVault API...")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="WhaleVault API",
        description="Privacy-preserving SOL transactions using zero-knowledge proofs",
        version="0.1.0",
        lifespan=lifespan,
        debug=settings.debug,
    )

    # Rate limiter state
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # CSRF protection middleware (validates Origin header)
    # Must be added before CORS middleware
    if not settings.debug:
        # Only enable CSRF in production to allow testing with curl/Postman
        app.add_middleware(CSRFMiddleware, allowed_origins=settings.cors_origins_list)

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include API routes
    app.include_router(api_router, prefix="/api")

    return app


app = create_app()


@app.exception_handler(WhaleVaultError)
async def whalevault_exception_handler(request: Request, exc: WhaleVaultError):
    """Handle custom WhaleVault exceptions with structured error responses."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
                "request_id": str(uuid.uuid4()),
            }
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions with a generic error response."""
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "details": {"type": type(exc).__name__},
                "request_id": str(uuid.uuid4()),
            }
        },
    )
