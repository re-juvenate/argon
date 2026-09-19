import pytest

from runner.dependencies import get_runner_service, get_runner_settings
from runner.schemas import RunStatus
from runner.service import RunnerService
from runner.settings import RunnerSettings
from runner.store import StatusStore
from main import app

EC2_FILES = {"files": {"__main__.py": "print(1)"}}


class NoopQueue:
    def put(self, job):
        pass

    def get(self, timeout):
        return None

    def task_done(self):
        pass


class NoopProcess:
    def start_pulumi_up(self, path, req, settings):
        return object()


@pytest.fixture
def service(client, tmp_path):
    settings = RunnerSettings(root=str(tmp_path))
    store = StatusStore(log_lines=50)
    svc = RunnerService(settings, store, NoopQueue(), process=NoopProcess())
    app.dependency_overrides[get_runner_service] = lambda: svc
    return svc


def test_create_workspace_returns_201(client, service):
    res = client.post("/runs/workspaces")
    assert res.status_code == 201
    body = res.json()
    assert body["folder"]
    assert body["path"].endswith(body["folder"])


def test_submit_run_returns_202(client, service):
    res = client.post("/runs/", json=EC2_FILES)
    assert res.status_code == 202
    body = res.json()
    assert body["status"] == "queued"
    assert "credentials" not in body


def test_submit_run_missing_main_is_422(client, service):
    res = client.post("/runs/", json={"files": {"other.py": "x"}})
    assert res.status_code == 422


def test_submit_run_unknown_folder_is_400(client, service):
    res = client.post("/runs/", json={**EC2_FILES, "folder": "does-not-exist"})
    assert res.status_code == 400


def test_get_run_found(client, service):
    created = client.post("/runs/", json=EC2_FILES).json()
    res = client.get(f"/runs/{created['folder']}")
    assert res.status_code == 200
    assert res.json()["folder"] == created["folder"]


def test_get_run_missing_is_404(client, service):
    res = client.get("/runs/nope")
    assert res.status_code == 404


def test_list_runs(client, service):
    assert client.get("/runs/").json() == []
    client.post("/runs/", json=EC2_FILES)
    assert len(client.get("/runs/").json()) == 1


def test_logs_endpoint(client, service):
    created = client.post("/runs/", json=EC2_FILES).json()
    service.store.append_log(created["folder"], "hello")
    res = client.get(f"/runs/{created['folder']}/logs")
    assert res.status_code == 200
    assert res.json() == ["hello"]


def test_logs_endpoint_missing_folder_is_404(client, service):
    res = client.get("/runs/nope/logs")
    assert res.status_code == 404


def test_credentials_never_echoed(client, service):
    payload = {
        "files": {"__main__.py": "print(1)"},
        "credentials": {"access_key_id": "AKIA", "secret_access_key": "s3cr3t"},
    }
    res = client.post("/runs/", json=payload)
    assert "AKIA" not in res.text
    assert "s3cr3t" not in res.text


def test_default_dependencies():
    app.dependency_overrides.clear()
    svc = get_runner_service()
    assert isinstance(svc, RunnerService)
    assert get_runner_service() is svc
    assert isinstance(get_runner_settings(), RunnerSettings)
