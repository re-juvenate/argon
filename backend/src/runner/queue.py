import queue
from typing import Protocol


class JobQueue(Protocol):
    def put(self, job: object) -> None: ...
    def get(self, timeout: float) -> object | None: ...
    def task_done(self) -> None: ...


class InMemoryJobQueue:
    def __init__(self) -> None:
        self._queue: queue.Queue = queue.Queue()

    def put(self, job: object) -> None:
        self._queue.put(job)

    def get(self, timeout: float) -> object | None:
        try:
            return self._queue.get(timeout=timeout)
        except queue.Empty:
            return None

    def task_done(self) -> None:
        self._queue.task_done()
