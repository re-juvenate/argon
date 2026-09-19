from unittest.mock import MagicMock

import pytest

from deploy.schemas import DeploymentCreate, DeploymentStatus, Target
from deploy.service import DeploymentService
from deploy.settings import Settings


class FakeRunner:
    def __init__(self, outputs=None, up_error=None, destroy_error=None):
        self.outputs = outputs or {"url": "http://x"}
        self.up_error = up_error
        self.destroy_error = destroy_error
        self.selected = []
        self.stack = MagicMock()

    def select_stack(self, req, program, settings):
        self.selected.append((req, program, settings))
        return self.stack

    def up(self, stack):
        if self.up_error:
            raise self.up_error
        return self.outputs

    def destroy(self, stack):
        if self.destroy_error:
            raise self.destroy_error


@pytest.fixture
def runner():
    return FakeRunner()


@pytest.fixture
def settings():
    return Settings(pulumi_backend_url="file:///tmp/x", pulumi_config_passphrase="", pulumi_project="p")


@pytest.fixture
def service(runner, settings):
    return DeploymentService(settings, runner)


@pytest.fixture
def ec2_req():
    return DeploymentCreate(name="demo", target="ec2", ec2={})


@pytest.fixture
def apprunner_req():
    return DeploymentCreate(name="svc", target="apprunner", apprunner={"image": "img"})


def test_create_stores_pending(service, ec2_req):
    rec = service.create(ec2_req)
    assert (rec.id, rec.name, rec.target, rec.status) == (1, "demo", Target.ec2, DeploymentStatus.pending)
    assert rec.outputs == {}
    assert service.get(1) is rec


def test_create_increments_ids(service, ec2_req, apprunner_req):
    assert service.create(ec2_req).id == 1
    assert service.create(apprunner_req).id == 2


def test_get_missing_returns_none(service):
    assert service.get(42) is None


def test_list_preserves_order(service, ec2_req, apprunner_req):
    service.create(ec2_req)
    service.create(apprunner_req)
    assert [d.name for d in service.list()] == ["demo", "svc"]


def test_run_success_sets_outputs(service, runner, ec2_req, settings):
    rec = service.create(ec2_req)
    service.run(rec.id)
    assert rec.status is DeploymentStatus.succeeded
    assert rec.outputs == {"url": "http://x"}
    assert rec.error is None
    req, program, used_settings = runner.selected[0]
    assert req is ec2_req
    assert callable(program)
    assert used_settings is settings


def test_run_apprunner(service, runner, apprunner_req):
    rec = service.create(apprunner_req)
    service.run(rec.id)
    assert rec.status is DeploymentStatus.succeeded
    assert runner.selected[0][0] is apprunner_req


def test_run_failure_records_error(settings, ec2_req):
    runner = FakeRunner(up_error=RuntimeError("aws exploded"))
    service = DeploymentService(settings, runner)
    rec = service.create(ec2_req)
    service.run(rec.id)
    assert rec.status is DeploymentStatus.failed
    assert rec.error == "aws exploded"
    assert rec.outputs == {}


def test_run_unknown_id_is_noop(service):
    service.run(99)


def test_run_marks_running_before_up(settings, ec2_req):
    seen = []

    class Spy(FakeRunner):
        def up(self, stack):
            seen.append(service.get(1).status)
            return {}

    service = DeploymentService(settings, Spy())
    service.run(service.create(ec2_req).id)
    assert seen == [DeploymentStatus.running]


def test_destroy_succeeded_deployment(service, ec2_req):
    rec = service.create(ec2_req)
    service.run(rec.id)
    service.destroy(rec.id)
    assert rec.status is DeploymentStatus.destroyed
    assert rec.outputs == {}


def test_destroy_failed_deployment_allowed(settings, ec2_req):
    runner = FakeRunner(up_error=RuntimeError("x"))
    service = DeploymentService(settings, runner)
    rec = service.create(ec2_req)
    service.run(rec.id)
    service.destroy(rec.id)
    assert rec.status is DeploymentStatus.destroyed
    assert rec.error is None


def test_destroy_failure_records_error(settings, ec2_req):
    runner = FakeRunner(destroy_error=RuntimeError("stuck"))
    service = DeploymentService(settings, runner)
    rec = service.create(ec2_req)
    service.run(rec.id)
    service.destroy(rec.id)
    assert rec.status is DeploymentStatus.failed
    assert rec.error == "stuck"


def test_destroy_unknown_id_is_noop(service):
    service.destroy(99)


@pytest.mark.parametrize("status", [DeploymentStatus.pending, DeploymentStatus.running, DeploymentStatus.destroying])
def test_can_destroy_rejects_active_states(service, ec2_req, status):
    rec = service.create(ec2_req)
    rec.status = status
    with pytest.raises(ValueError):
        service.ensure_destroyable(rec.id)


@pytest.mark.parametrize("status", [DeploymentStatus.succeeded, DeploymentStatus.failed, DeploymentStatus.destroyed])
def test_can_destroy_accepts_terminal_states(service, ec2_req, status):
    rec = service.create(ec2_req)
    rec.status = status
    assert service.ensure_destroyable(rec.id) is rec


def test_ensure_destroyable_missing_returns_none(service):
    assert service.ensure_destroyable(5) is None


def test_default_runner_is_workspace_module(settings):
    from deploy.pulumi import workspace

    assert DeploymentService(settings).runner is workspace
