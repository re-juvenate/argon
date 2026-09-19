import pytest

from runner.schemas import RunCreate, RunStatus
from runner.service import RunnerService
from runner.settings import RunnerSettings
from runner.store import StatusStore


class FakeQueue:
    def __init__(self):
        self.jobs = []

    def put(self, job):
        self.jobs.append(job)

    def get(self, timeout):
        return None

    def task_done(self):
        pass


class FakeJob:
    def __init__(self, folder, path):
        self.folder = folder
        self.path = path


class FakeProcess:
    def __init__(self):
        self.calls = []

    def start_pulumi_up(self, path, req, settings):
        self.calls.append((path, req, settings))
        return FakeJob(path.name, path)


@pytest.fixture
def settings(tmp_path):
    return RunnerSettings(root=str(tmp_path))


@pytest.fixture
def store():
    return StatusStore(log_lines=10)


@pytest.fixture
def job_queue():
    return FakeQueue()


@pytest.fixture
def fake_process():
    return FakeProcess()


@pytest.fixture
def service(settings, store, job_queue, fake_process):
    return RunnerService(settings, store, job_queue, process=fake_process)


def test_create_workspace_returns_folder_and_path(service):
    ws = service.create_workspace()
    assert ws.folder
    assert ws.path.endswith(ws.folder)


def test_submit_creates_new_workspace_when_no_folder(service, store, job_queue):
    req = RunCreate(files={"__main__.py": "print(1)"})
    result = service.submit(req)
    assert result.status is RunStatus.queued
    assert store.get(result.folder) is not None
    assert len(job_queue.jobs) == 1


def test_submit_writes_files_to_workspace(service, settings):
    req = RunCreate(files={"__main__.py": "print(1)", "helper.py": "x = 1"})
    result = service.submit(req)
    from pathlib import Path

    path = Path(result.path)
    assert (path / "__main__.py").read_text() == "print(1)"
    assert (path / "helper.py").read_text() == "x = 1"


def test_submit_writes_project_file(service):
    from pathlib import Path

    req = RunCreate(files={"__main__.py": "print(1)"}, project="custom-proj")
    result = service.submit(req)
    assert "custom-proj" in (Path(result.path) / "Pulumi.yaml").read_text()


def test_submit_reuses_existing_folder(service, store):
    ws = service.create_workspace()
    req = RunCreate(files={"__main__.py": "print(1)"}, folder=ws.folder)
    result = service.submit(req)
    assert result.folder == ws.folder
    assert result.path == ws.path


def test_submit_unknown_folder_raises(service):
    req = RunCreate(files={"__main__.py": "print(1)"}, folder="does-not-exist")
    with pytest.raises(ValueError):
        service.submit(req)


def test_get_and_list(service):
    req = RunCreate(files={"__main__.py": "print(1)"})
    result = service.submit(req)
    assert service.get(result.folder).folder == result.folder
    assert len(service.list()) == 1


def test_get_missing_returns_none(service):
    assert service.get("nope") is None


def test_logs_returns_captured_lines(service, store):
    req = RunCreate(files={"__main__.py": "print(1)"})
    result = service.submit(req)
    store.append_log(result.folder, "hello")
    assert service.logs(result.folder) == ["hello"]
