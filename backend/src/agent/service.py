from agent.schemas import AgentCreate, AgentRead


class AgentService:
    def __init__(self) -> None:
        self._counter = 0
        self._store: dict[int, AgentRead] = {}

    def create(self, payload: AgentCreate) -> AgentRead:
        self._counter += 1
        agent = AgentRead(id=self._counter, **payload.model_dump())
        self._store[agent.id] = agent
        return agent

    def get(self, agent_id: int) -> AgentRead | None:
        return self._store.get(agent_id)

    def list(self) -> list[AgentRead]:
        return list(self._store.values())
