import time
from fastapi import APIRouter, Depends
import httpx

from models.responses import HealthResponse
from config import get_settings, Settings

router = APIRouter()

API_VERSION = "0.1.0"


@router.get("/health", response_model=HealthResponse)
async def health_check(
    settings: Settings = Depends(get_settings),
) -> HealthResponse:
    """
    Health check endpoint.

    Verifies the API is running and checks Solana RPC connectivity.
    """
    solana_connected = False
    rpc_latency = None

    try:
        start = time.perf_counter()
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                settings.solana_rpc_url,
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getHealth",
                },
            )
            if response.status_code == 200:
                solana_connected = True
                rpc_latency = (time.perf_counter() - start) * 1000  # Convert to ms
    except Exception:
        pass  # Connection failed, solana_connected stays False

    return HealthResponse(
        status="healthy" if solana_connected else "degraded",
        version=API_VERSION,
        solanaConnection=solana_connected,
        rpcLatency=round(rpc_latency, 2) if rpc_latency else None,
        programId=settings.program_id,
    )
