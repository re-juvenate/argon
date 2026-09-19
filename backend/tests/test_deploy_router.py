import pytest

from deploy.dependencies import get_deployment_service, get_settings
from deploy.schemas import DeploymentStatus
from deploy.service import DeploymentService
from deploy.settings import Settings
from main import app
from tests.test_deploy_service import FakeRunner

EC2 = {"name": "demo", "target": "ec2", "ec2": {"port": 8000}}


@pytest.fixture
def runner():
    return FakeRunner(outputs={"url": "http://demo"})


@pytest.fixture
def service(client, runner):
    svc = DeploymentService(Settings(pulumi_project="t"), runner)
    app.dependency_overrides[get_deployment_service] = lambda: svc
    return svc


def test_create_returns_202_and_runs_in_background(client, service):
    res = client.post("/deployments/", json=EC2)
    assert res.status_code == 202
    body = res.json()
    assert body["id"] == 1 and body["name"] == "demo" and body["status"] == "pending"
    assert service.get(1).status is DeploymentStatus.succeeded
    assert client.get("/deployments/1").json()["outputs"] == {"url": "http://demo"}


def test_create_failure_visible_via_get(client):
    svc = DeploymentService(Settings(), FakeRunner(up_error=RuntimeError("bad creds")))
    app.dependency_overrides[get_deployment_service] = lambda: svc
    client.post("/deployments/", json=EC2)
    body = client.get("/deployments/1").json()
    assert body["status"] == "failed"
    assert body["error"] == "bad creds"


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"name": "demo", "target": "ec2"},
        {"name": "Demo", "target": "ec2", "ec2": {}},
        {"name": "demo", "target": "apprunner", "apprunner": {}},
        {"name": "demo", "target": "ec2", "ec2": {"port": 70000}},
    ],
)
def test_create_invalid_payload_is_422(client, service, payload):
    assert client.post("/deployments/", json=payload).status_code == 422
    assert service.list() == []


def test_get_missing_is_404(client, service):
    res = client.get("/deployments/7")
    assert res.status_code == 404
    assert res.json()["detail"] == "Deployment not found"


def test_get_non_int_id_is_422(client, service):
    assert client.get("/deployments/x").status_code == 422


def test_list(client, service):
    assert client.get("/deployments/").json() == []
    client.post("/deployments/", json=EC2)
    client.post("/deployments/", json={**EC2, "name": "two"})
    assert [d["name"] for d in client.get("/deployments/").json()] == ["demo", "two"]


def test_delete_destroys(client, service):
    client.post("/deployments/", json=EC2)
    res = client.delete("/deployments/1")
    assert res.status_code == 202
    assert res.json()["status"] == "destroying"
    assert client.get("/deployments/1").json()["status"] == "destroyed"


def test_delete_missing_is_404(client, service):
    assert client.delete("/deployments/9").status_code == 404


def test_delete_active_is_409(client, service):
    client.post("/deployments/", json=EC2)
    service.get(1).status = DeploymentStatus.running
    res = client.delete("/deployments/1")
    assert res.status_code == 409
    assert "running" in res.json()["detail"]


def test_default_dependencies(client):
    app.dependency_overrides.clear()
    svc = get_deployment_service()
    assert isinstance(svc, DeploymentService)
    assert get_deployment_service() is svc
    assert isinstance(get_settings(), Settings)
    assert svc.settings is get_settings()
