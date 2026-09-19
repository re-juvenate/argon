from enum import Enum

from pydantic import BaseModel, Field, model_validator


class Target(str, Enum):
    ec2 = "ec2"
    apprunner = "apprunner"


class Ec2Options(BaseModel):
    instance_type: str = "t3.micro"
    ami: str | None = None
    user_data: str | None = None
    port: int = Field(80, ge=1, le=65535)


class AppRunnerOptions(BaseModel):
    image: str
    port: int = Field(8080, ge=1, le=65535)
    cpu: str = "1024"
    memory: str = "2048"


class DeploymentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40, pattern=r"^[a-z][a-z0-9-]*$")
    region: str = "us-east-1"
    target: Target
    ec2: Ec2Options | None = None
    apprunner: AppRunnerOptions | None = None
    cloudfront: bool = False

    @model_validator(mode="after")
    def options_match_target(self) -> "DeploymentCreate":
        for target in Target:
            present = getattr(self, target.value) is not None
            if target is self.target and not present:
                raise ValueError(f"{target.value} options are required for target {target.value}")
            if target is not self.target and present:
                raise ValueError(f"{target.value} options are not allowed for target {self.target.value}")
        return self


class DeploymentStatus(str, Enum):
    pending = "pending"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    destroying = "destroying"
    destroyed = "destroyed"


class DeploymentRead(BaseModel):
    id: int
    name: str
    target: Target
    status: DeploymentStatus
    outputs: dict[str, str] = {}
    error: str | None = None
