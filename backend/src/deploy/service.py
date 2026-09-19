from deploy.pulumi import workspace
from deploy.pulumi.program import build_program
from deploy.schemas import DeploymentCreate, DeploymentRead, DeploymentStatus
from deploy.settings import Settings

ACTIVE = {DeploymentStatus.pending, DeploymentStatus.running, DeploymentStatus.destroying}


class DeploymentService:
    def __init__(self, settings: Settings, runner=workspace) -> None:
        self.settings = settings
        self.runner = runner
        self._counter = 0
        self._store: dict[int, DeploymentRead] = {}
        self._requests: dict[int, DeploymentCreate] = {}

    def create(self, payload: DeploymentCreate) -> DeploymentRead:
        self._counter += 1
        record = DeploymentRead(
            id=self._counter, name=payload.name, target=payload.target, status=DeploymentStatus.pending
        )
        self._store[record.id] = record
        self._requests[record.id] = payload
        return record

    def get(self, deployment_id: int) -> DeploymentRead | None:
        return self._store.get(deployment_id)

    def list(self) -> list[DeploymentRead]:
        return list(self._store.values())

    def ensure_destroyable(self, deployment_id: int) -> DeploymentRead | None:
        record = self.get(deployment_id)
        if record is not None and record.status in ACTIVE:
            raise ValueError(f"Deployment {deployment_id} is {record.status.value}")
        return record

    def _stack(self, deployment_id: int):
        req = self._requests[deployment_id]
        return self.runner.select_stack(req, build_program(req), self.settings)

    def run(self, deployment_id: int) -> None:
        record = self.get(deployment_id)
        if record is None:
            return
        record.status = DeploymentStatus.running
        try:
            record.outputs = self.runner.up(self._stack(deployment_id))
            record.status = DeploymentStatus.succeeded
        except Exception as exc:
            record.status = DeploymentStatus.failed
            record.error = str(exc)

    def destroy(self, deployment_id: int) -> None:
        record = self.get(deployment_id)
        if record is None:
            return
        record.status = DeploymentStatus.destroying
        try:
            self.runner.destroy(self._stack(deployment_id))
            record.status = DeploymentStatus.destroyed
            record.outputs = {}
            record.error = None
        except Exception as exc:
            record.status = DeploymentStatus.failed
            record.error = str(exc)
