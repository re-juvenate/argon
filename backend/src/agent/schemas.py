from pydantic import BaseModel


class AgentCreate(BaseModel):
    name: str
    description: str | None = None


class AgentRead(BaseModel):
    id: int
    name: str
    description: str | None = None

    model_config = {"from_attributes": True}
