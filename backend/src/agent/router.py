from fastapi import APIRouter, Depends, HTTPException, Response

from agent.dependencies import get_agent_settings, get_completion_service, get_session_id, get_session_issuer
from agent.groq import Throttled
from agent.schemas import CompletionCreate, CompletionRead, SessionRead
from agent.service import CompletionService
from agent.session import SessionIssuer
from agent.settings import AgentSettings

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/session", response_model=SessionRead, status_code=201)
def create_session(
    response: Response,
    issuer: SessionIssuer = Depends(get_session_issuer),
    settings: AgentSettings = Depends(get_agent_settings),
) -> SessionRead:
    key, token, exp = issuer.issue()
    response.set_cookie("session", token, max_age=settings.session_ttl_seconds, httponly=True, samesite="lax")
    return SessionRead(token=token, session_id=key, expires_at=exp, expires_in=settings.session_ttl_seconds)


@router.post("/complete", response_model=CompletionRead, response_model_exclude_none=True)
def complete(
    payload: CompletionCreate,
    session_id: str = Depends(get_session_id),
    service: CompletionService = Depends(get_completion_service),
) -> CompletionRead:
    try:
        return service.complete(session_id, payload.graph, payload.prompt)
    except Throttled as error:
        raise HTTPException(status_code=429, detail=str(error), headers={"Retry-After": str(int(error.retry_after) + 1)}) from error
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
