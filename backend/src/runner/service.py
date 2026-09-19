from __future__ import annotations

from runner import process as process_module
from runner import workspace
from runner.queue import JobQueue
from runner.schemas import RunCreate, RunRead, WorkspaceRead
from runner.settings import RunnerSettings
from runner.store import RunRecord, StatusStore


class RunnerService:
    def __init__(
        self,
        settings: RunnerSettings,
        store: StatusStore,
        job_queue: JobQueue,
        workspace_module=workspace,
        process=process_module,
    ) -> None:
        self.settings = settings
        self.store = store
        self.queue = job_queue
        self.workspace = workspace_module
        self.process = process

    def create_workspace(self) -> WorkspaceRead:
        path = self.workspace.create_workspace(self.settings)
        return WorkspaceRead(folder=path.name, path=str(path))

    def submit(self, payload: RunCreate) -> RunRead:
        if payload.folder is not None:
            path = self.workspace.resolve_workspace(payload.folder, self.settings)
        else:
            path = self.workspace.create_workspace(self.settings)
        self.workspace.write_files(path, payload.files)
        self.workspace.ensure_project_file(path, payload.project)
        record = self.store.create(folder=path.name, path=str(path))
        job = self.process.start_pulumi_up(path, payload, self.settings)
        self.queue.put(job)
        return _to_read(record)

    def get(self, folder: str) -> RunRead | None:
        record = self.store.get(folder)
        return _to_read(record) if record is not None else None

    def list(self) -> list[RunRead]:
        return [_to_read(record) for record in self.store.list()]

    def logs(self, folder: str) -> list[str]:
        return self.store.logs(folder)


def _to_read(record: RunRecord) -> RunRead:
    return RunRead(
        folder=record.folder,
        path=record.path,
        status=record.status,
        exit_code=record.exit_code,
        error=record.error,
    )
