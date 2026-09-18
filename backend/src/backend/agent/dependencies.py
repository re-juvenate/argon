from functools import lru_cache

from backend.agent.service import AgentService


@lru_cache
def get_agent_service() -> AgentService:
    return AgentService()
