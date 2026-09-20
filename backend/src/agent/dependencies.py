from functools import lru_cache

from fastapi import Depends, HTTPException, Request

from agent.service import CompletionService, build_planner
from agent.session import SessionError, SessionIssuer
from agent.settings import AgentSettings


@lru_cache
def get_agent_settings() -> AgentSettings:
    return AgentSettings()


@lru_cache
def get_session_issuer() -> SessionIssuer:
    return SessionIssuer(get_agent_settings())


@lru_cache
def get_completion_service() -> CompletionService:
    return CompletionService(build_planner(get_agent_settings()))


def get_session_id(request: Request, issuer: SessionIssuer = Depends(get_session_issuer)) -> str:
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else request.cookies.get("session", "")
    if not token:
        raise HTTPException(status_code=401, detail="Session required")
    try:
        return issuer.verify(token)
    except SessionError as error:
        raise HTTPException(status_code=401, detail=f"Invalid session: {error}") from error
