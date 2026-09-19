from __future__ import annotations

import threading
from collections import deque
from dataclasses import dataclass, field

from runner.schemas import RunStatus


@dataclass
class RunRecord:
    folder: str
    path: str
    status: RunStatus
    exit_code: int | None = None
    error: str | None = None
    logs: deque[str] = field(default_factory=deque, repr=False)


class StatusStore:
    def __init__(self, log_lines: int) -> None:
        self._log_lines = log_lines
        self._lock = threading.Lock()
        self._records: dict[str, RunRecord] = {}

    def create(self, folder: str, path: str) -> RunRecord:
        record = RunRecord(
            folder=folder,
            path=path,
            status=RunStatus.queued,
            logs=deque(maxlen=self._log_lines),
        )
        with self._lock:
            self._records[folder] = record
        return record

    def get(self, folder: str) -> RunRecord | None:
        with self._lock:
            return self._records.get(folder)

    def list(self) -> list[RunRecord]:
        with self._lock:
            return list(self._records.values())

    def set_status(
        self,
        folder: str,
        status: RunStatus,
        exit_code: int | None = None,
        error: str | None = None,
    ) -> None:
        with self._lock:
            record = self._records.get(folder)
            if record is None:
                return
            record.status = status
            record.exit_code = exit_code
            record.error = error

    def append_log(self, folder: str, line: str) -> None:
        with self._lock:
            record = self._records.get(folder)
            if record is None:
                return
            record.logs.append(line)

    def logs(self, folder: str) -> list[str]:
        with self._lock:
            record = self._records.get(folder)
            return list(record.logs) if record is not None else []
