from fastapi import APIRouter, Depends

from models.responses import PoolStatusResponse
from services.pool_service import PoolService
from config import get_settings, Settings

router = APIRouter()


def get_pool_service(settings: Settings = Depends(get_settings)) -> PoolService:
    """Dependency to get PoolService."""
    return PoolService(
        rpc_url=settings.solana_rpc_url,
        program_id=settings.program_id,
    )


@router.get("/status", response_model=PoolStatusResponse)
async def get_pool_status(
    pool_service: PoolService = Depends(get_pool_service),
) -> PoolStatusResponse:
    """
    Get the current status of the privacy pool.

    Returns statistics about the pool including total value locked,
    number of deposits, and anonymity set size.
    """
    stats = await pool_service.get_pool_status()

    return PoolStatusResponse(
        totalValueLocked=stats.total_value_locked,
        totalDeposits=stats.total_deposits,
        anonymitySetSize=stats.anonymity_set_size,
    )
