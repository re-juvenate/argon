from functools import lru_cache

from deploy.service import DeploymentService
from deploy.settings import Settings


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_deployment_service() -> DeploymentService:
    return DeploymentService(get_settings())
