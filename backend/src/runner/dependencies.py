from functools import lru_cache

from runner.queue import InMemoryJobQueue
from runner.service import RunnerService
from runner.settings import RunnerSettings
from runner.store import StatusStore


@lru_cache
def get_runner_settings() -> RunnerSettings:
    return RunnerSettings()


@lru_cache
def get_runner_store() -> StatusStore:
    return StatusStore(log_lines=get_runner_settings().log_lines)


@lru_cache
def get_runner_queue() -> InMemoryJobQueue:
    return InMemoryJobQueue()


@lru_cache
def get_runner_service() -> RunnerService:
    return RunnerService(get_runner_settings(), get_runner_store(), get_runner_queue())
