from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from deploy.dependencies import get_deployment_service
from deploy.schemas import DeploymentCreate, DeploymentRead, DeploymentStatus
from deploy.service import DeploymentService

router = APIRouter(prefix="/deployments", tags=["deployments"])


@router.post("/", response_model=DeploymentRead, status_code=202)
def create_deployment(
    payload: DeploymentCreate,
    tasks: BackgroundTasks,
    service: DeploymentService = Depends(get_deployment_service),
) -> DeploymentRead:
    deployment = service.create(payload)
    tasks.add_task(service.run, deployment.id)
    return deployment


@router.get("/{deployment_id}", response_model=DeploymentRead)
def get_deployment(
    deployment_id: int,
    service: DeploymentService = Depends(get_deployment_service),
) -> DeploymentRead:
    deployment = service.get(deployment_id)
    if deployment is None:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return deployment


@router.get("/", response_model=list[DeploymentRead])
def list_deployments(
    service: DeploymentService = Depends(get_deployment_service),
) -> list[DeploymentRead]:
    return service.list()


@router.delete("/{deployment_id}", response_model=DeploymentRead, status_code=202)
def destroy_deployment(
    deployment_id: int,
    tasks: BackgroundTasks,
    service: DeploymentService = Depends(get_deployment_service),
) -> DeploymentRead:
    try:
        deployment = service.ensure_destroyable(deployment_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if deployment is None:
        raise HTTPException(status_code=404, detail="Deployment not found")
    deployment.status = DeploymentStatus.destroying
    tasks.add_task(service.destroy, deployment.id)
    return deployment
