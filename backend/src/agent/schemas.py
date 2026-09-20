from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, Field


class ServiceType(StrEnum):
    ec2 = "ec2"
    ecs = "ecs"
    asg = "asg"
    lb = "lb"
    sqs = "sqs"
    lambda_ = "lambda"
    s3 = "s3"
    cloudfront = "cloudfront"
    route53 = "route53"
    aurora = "aurora"
    ebs = "ebs"
    efs = "efs"
    rds = "rds"
    apigateway = "apigateway"
    dynamodb = "dynamodb"
    sns = "sns"
    elasticache = "elasticache"
    kinesis = "kinesis"
    client = "client"
    region = "region"
    vpc = "vpc"


class Position(BaseModel):
    x: float
    y: float


class GraphNode(BaseModel):
    id: str = Field(min_length=1)
    service: ServiceType
    name: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    position: Position | None = None
    parentId: str | None = None


class GraphEdge(BaseModel):
    id: str = Field(min_length=1)
    from_: str = Field(alias="from", min_length=1)
    to: str = Field(min_length=1)
    avgBytes: float | None = Field(default=None, gt=0)

    model_config = {"populate_by_name": True}


class GlobalDefaults(BaseModel):
    dtSeconds: float = Field(default=1, gt=0)
    avgBytes: float | None = Field(default=None, gt=0)


class Graph(BaseModel):
    version: Literal[1] = 1
    defaults: GlobalDefaults = Field(default_factory=GlobalDefaults)
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)


class PlannedNode(BaseModel):
    id: str = Field(min_length=1)
    service: ServiceType
    name: str | None
    config: str = Field(description="JSON object of config overrides, or {}")
    x: float
    y: float
    parentId: str | None


class PlannedEdge(BaseModel):
    id: str = Field(min_length=1)
    source: str = Field(min_length=1)
    target: str = Field(min_length=1)


class PlannedUpdate(BaseModel):
    id: str = Field(min_length=1)
    name: str | None
    config: str | None = Field(description="JSON object string to merge into the node config, or null")
    x: float | None
    y: float | None


class Plan(BaseModel):
    rationale: str
    nodes: list[PlannedNode]
    edges: list[PlannedEdge]
    removeEdges: list[str]
    updates: list[PlannedUpdate]


class NodeUpdate(BaseModel):
    id: str
    name: str | None = None
    config: dict[str, Any] | None = None
    position: Position | None = None


class SessionRead(BaseModel):
    token: str
    session_id: str
    expires_at: int
    expires_in: int


class CompletionCreate(BaseModel):
    graph: Graph
    prompt: str | None = None


class Additions(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    removedEdges: list[str] = Field(default_factory=list)
    updates: list[NodeUpdate] = Field(default_factory=list)


class CompletionRead(BaseModel):
    session_id: str
    rationale: str
    graph: Graph
    added: Additions
