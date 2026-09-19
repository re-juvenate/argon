from fastapi import APIRouter, Depends, HTTPException

from runner.dependencies import get_runner_service
from runner.schemas import RunCreate, RunRead, WorkspaceRead
from runner.service import RunnerService

router = APIRouter(prefix="/runs", tags=["runs"])


@router.post("/workspaces", response_model=WorkspaceRead, status_code=201)
def create_workspace(
    service: RunnerService = Depends(get_runner_service),
) -> WorkspaceRead:
    return service.create_workspace()


@router.post("/", response_model=RunRead, status_code=202)
def submit_run(
    payload: RunCreate,
    service: RunnerService = Depends(get_runner_service),
) -> RunRead:
    try:
        return service.submit(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{folder}", response_model=RunRead)
def get_run(
    folder: str,
    service: RunnerService = Depends(get_runner_service),
) -> RunRead:
    run = service.get(folder)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.get("/", response_model=list[RunRead])
def list_runs(
    service: RunnerService = Depends(get_runner_service),
) -> list[RunRead]:
    return service.list()


@router.get("/{folder}/logs", response_model=list[str])
def get_logs(
    folder: str,
    service: RunnerService = Depends(get_runner_service),
) -> list[str]:
    if service.get(folder) is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return service.logs(folder)
