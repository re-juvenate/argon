from fastapi import APIRouter, Depends, HTTPException

from backend.agent.dependencies import get_agent_service
from backend.agent.schemas import AgentCreate, AgentRead
from backend.agent.service import AgentService

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("/", response_model=AgentRead, status_code=201)
def create_agent(
    payload: AgentCreate,
    service: AgentService = Depends(get_agent_service),
) -> AgentRead:
    return service.create(payload)


@router.get("/{agent_id}", response_model=AgentRead)
def get_agent(
    agent_id: int,
    service: AgentService = Depends(get_agent_service),
) -> AgentRead:
    agent = service.get(agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.get("/", response_model=list[AgentRead])
def list_agents(
    service: AgentService = Depends(get_agent_service),
) -> list[AgentRead]:
    return service.list()
