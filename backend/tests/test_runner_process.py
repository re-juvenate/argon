import sys
import time

import pytest

from runner import process
from runner.schemas import AwsCredentials, RunCreate
from runner.settings import RunnerSettings


@pytest.fixture
def settings():
    return RunnerSettings(pulumi_bin="pulumi", backend_url="file:///tmp/x", passphrase="pw")


def test_build_env_carries_region_and_backend(settings):
    env = process.build_env(settings, region="eu-west-1", credentials=None)
    assert env["AWS_REGION"] == "eu-west-1"
    assert env["AWS_DEFAULT_REGION"] == "eu-west-1"
    assert env["PULUMI_BACKEND_URL"] == "file:///tmp/x"
    assert env["PULUMI_CONFIG_PASSPHRASE"] == "pw"
    assert env["PULUMI_SKIP_UPDATE_CHECK"] == "true"


def test_build_env_inherits_server_env(settings, monkeypatch):
    monkeypatch.setenv("SOME_CUSTOM_VAR", "hello")
    env = process.build_env(settings, region="us-east-1", credentials=None)
    assert env["SOME_CUSTOM_VAR"] == "hello"


def test_build_env_without_credentials_has_no_aws_keys(settings):
    env = process.build_env(settings, region="us-east-1", credentials=None)
    assert "AWS_ACCESS_KEY_ID" not in env
    assert "AWS_SECRET_ACCESS_KEY" not in env
    assert "AWS_SESSION_TOKEN" not in env


def test_build_env_overlays_credentials(settings):
    creds = AwsCredentials(access_key_id="AKIA", secret_access_key="secret")
    env = process.build_env(settings, region="us-east-1", credentials=creds)
    assert env["AWS_ACCESS_KEY_ID"] == "AKIA"
    assert env["AWS_SECRET_ACCESS_KEY"] == "secret"
    assert "AWS_SESSION_TOKEN" not in env


def test_build_env_includes_session_token_when_present(settings):
    creds = AwsCredentials(access_key_id="AKIA", secret_access_key="s", session_token="tok")
    env = process.build_env(settings, region="us-east-1", credentials=creds)
    assert env["AWS_SESSION_TOKEN"] == "tok"


def test_build_command_shape(settings):
    cmd = process.build_command(settings, stack="dev")
    assert cmd == ["pulumi", "up", "--yes", "--non-interactive", "--stack", "dev", "--skip-preview"]


def test_build_command_uses_configured_binary():
    settings = RunnerSettings(pulumi_bin="/opt/pulumi/bin/pulumi")
    cmd = process.build_command(settings, stack="prod")
    assert cmd[0] == "/opt/pulumi/bin/pulumi"
    assert "prod" in cmd


def python_script(body: str) -> list[str]:
    return [sys.executable, "-c", body]


def test_start_pulumi_up_builds_lazy_job(tmp_path, settings):
    req = RunCreate(files={"__main__.py": "print(1)"})
    job = process.start_pulumi_up(tmp_path, req, settings)
    assert job.path == tmp_path
    assert job.folder == tmp_path.name
    assert job.process is None


def test_job_start_and_wait_success(tmp_path):
    job = process.PulumiJob(
        folder=tmp_path.name, path=tmp_path,
        cmd=python_script("print('line1'); print('line2')"),
        env={"PATH": "/usr/bin:/bin"}, timeout=5,
    )
    job.start()
    lines = list(job.stream())
    code = job.wait()
    assert lines == ["line1", "line2"]
    assert code == 0


def test_job_wait_nonzero_exit(tmp_path):
    job = process.PulumiJob(
        folder=tmp_path.name, path=tmp_path,
        cmd=python_script("import sys; sys.exit(3)"),
        env={"PATH": "/usr/bin:/bin"}, timeout=5,
    )
    job.start()
    list(job.stream())
    assert job.wait() == 3


def test_job_runs_in_given_cwd(tmp_path):
    (tmp_path / "marker.txt").write_text("hi")
    job = process.PulumiJob(
        folder=tmp_path.name, path=tmp_path,
        cmd=python_script("import os; print(sorted(os.listdir('.')))"),
        env={"PATH": "/usr/bin:/bin"}, timeout=5,
    )
    job.start()
    lines = list(job.stream())
    job.wait()
    assert "marker.txt" in lines[0]


def test_job_timeout_kills_process(tmp_path):
    job = process.PulumiJob(
        folder=tmp_path.name, path=tmp_path,
        cmd=python_script("import time; time.sleep(30)"),
        env={"PATH": "/usr/bin:/bin"}, timeout=0.2,
    )
    job.start()
    start = time.monotonic()
    list(job.stream())
    elapsed = time.monotonic() - start
    assert elapsed < 5
    assert job.wait() != 0


def test_job_kill_before_start_is_noop(tmp_path):
    job = process.PulumiJob(folder="f", path=tmp_path, cmd=["true"], env={}, timeout=5)
    job.kill()


def test_job_kill_force_kills_process_ignoring_sigterm(tmp_path):
    job = process.PulumiJob(
        folder=tmp_path.name,
        path=tmp_path,
        cmd=python_script(
            "import signal, time; signal.signal(signal.SIGTERM, signal.SIG_IGN); time.sleep(30)"
        ),
        env={"PATH": "/usr/bin:/bin"},
        timeout=5,
    )
    job.start()
    time.sleep(0.3)
    start = time.monotonic()
    job.kill()
    elapsed = time.monotonic() - start
    assert elapsed >= 2
    assert elapsed < 10
    assert job.wait() != 0
