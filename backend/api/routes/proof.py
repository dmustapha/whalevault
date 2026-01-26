from fastapi import APIRouter, Depends

from models.responses import ProofStatusResponse, ProofStatus
from proof_queue.job_queue import ProofJobQueue
from api.deps import get_job_queue
from utils.errors import NotFoundError

router = APIRouter()


@router.get("/status/{job_id}", response_model=ProofStatusResponse)
async def get_proof_status(
    job_id: str,
    job_queue: ProofJobQueue = Depends(get_job_queue),
) -> ProofStatusResponse:
    """
    Get the status of a proof generation job.

    Poll this endpoint to check on the progress of proof generation.
    """
    job = await job_queue.get_status(job_id)

    if job is None:
        raise NotFoundError(f"Job {job_id} not found", details={"job_id": job_id})

    return ProofStatusResponse(
        jobId=job.id,
        status=ProofStatus(job.status.value),
        progress=job.progress,
        stage=job.stage,
        result=job.result,
        error=job.error,
    )
