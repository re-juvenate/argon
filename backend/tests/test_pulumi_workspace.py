from unittest.mock import MagicMock

import pulumi.automation as auto
import pytest

from deploy.pulumi import workspace
from deploy.schemas import DeploymentCreate
from deploy.settings import Settings


@pytest.fixture
def settings(tmp_path):
    return Settings(
        pulumi_backend_url=f"file://{tmp_path}",
        pulumi_config_passphrase="secret",
        pulumi_project="argon",
        pulumi_home=str(tmp_path / "home"),
    )


@pytest.fixture
def req():
    return DeploymentCreate(name="demo", region="eu-west-1", target="ec2", ec2={})


def test_settings_defaults(monkeypatch):
    for var in ("PULUMI_BACKEND_URL", "PULUMI_CONFIG_PASSPHRASE", "PULUMI_PROJECT", "PULUMI_HOME"):
        monkeypatch.delenv(var, raising=False)
    s = Settings()
    assert s.pulumi_backend_url.startswith("file://")
    assert s.pulumi_config_passphrase == ""
    assert s.pulumi_project == "argon"
    assert s.pulumi_home is None


def test_settings_from_env(monkeypatch):
    monkeypatch.setenv("PULUMI_BACKEND_URL", "s3://bucket")
    monkeypatch.setenv("PULUMI_CONFIG_PASSPHRASE", "pw")
    monkeypatch.setenv("PULUMI_PROJECT", "proj")
    monkeypatch.setenv("PULUMI_HOME", "/tmp/ph")
    s = Settings()
    assert (s.pulumi_backend_url, s.pulumi_config_passphrase, s.pulumi_project, s.pulumi_home) == (
        "s3://bucket", "pw", "proj", "/tmp/ph",
    )


def test_stack_name_combines_target_and_name(req):
    assert workspace.stack_name(req) == "ec2-demo"


def test_workspace_options(settings):
    opts = workspace.workspace_options(settings)
    assert isinstance(opts, auto.LocalWorkspaceOptions)
    assert opts.project_settings.name == "argon"
    assert opts.project_settings.runtime == "python"
    assert opts.project_settings.backend.url == settings.pulumi_backend_url
    assert opts.env_vars == {"PULUMI_CONFIG_PASSPHRASE": "secret"}
    assert opts.pulumi_home == settings.pulumi_home


def test_select_stack_configures_region(monkeypatch, settings, req):
    stack = MagicMock()
    created = {}

    def fake_create(stack_name, project_name, program, opts):
        created.update(stack_name=stack_name, project_name=project_name, program=program, opts=opts)
        return stack

    monkeypatch.setattr(auto, "create_or_select_stack", fake_create)
    program = lambda: None  # noqa: E731
    assert workspace.select_stack(req, program, settings) is stack
    assert created["stack_name"] == "ec2-demo"
    assert created["project_name"] == "argon"
    assert created["program"] is program
    assert created["opts"].project_settings.backend.url == settings.pulumi_backend_url
    stack.set_config.assert_called_once()
    key, value = stack.set_config.call_args.args
    assert key == "aws:region"
    assert value.value == "eu-west-1"


def test_up_maps_outputs_to_strings():
    stack = MagicMock()
    stack.up.return_value.outputs = {
        "url": auto.OutputValue(value="http://x", secret=False),
        "count": auto.OutputValue(value=3, secret=False),
        "token": auto.OutputValue(value="s3cr3t", secret=True),
    }
    assert workspace.up(stack) == {"url": "http://x", "count": "3", "token": "s3cr3t"}
    stack.up.assert_called_once_with(on_output=workspace.log_output)


def test_up_empty_outputs():
    stack = MagicMock()
    stack.up.return_value.outputs = {}
    assert workspace.up(stack) == {}


def test_up_propagates_errors():
    stack = MagicMock()
    stack.up.side_effect = auto.CommandError("boom")
    with pytest.raises(auto.CommandError):
        workspace.up(stack)


def test_destroy_removes_stack():
    stack = MagicMock()
    stack.name = "ec2-demo"
    workspace.destroy(stack)
    stack.destroy.assert_called_once_with(on_output=workspace.log_output)
    stack.workspace.remove_stack.assert_called_once_with("ec2-demo")


def test_destroy_failure_keeps_stack():
    stack = MagicMock()
    stack.destroy.side_effect = RuntimeError("nope")
    with pytest.raises(RuntimeError):
        workspace.destroy(stack)
    stack.workspace.remove_stack.assert_not_called()


def test_log_output_writes_line(caplog):
    with caplog.at_level("INFO", logger="deploy.pulumi.workspace"):
        workspace.log_output("hello")
    assert "hello" in caplog.text
