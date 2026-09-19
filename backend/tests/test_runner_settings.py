import tempfile

from runner.settings import RunnerSettings


def test_defaults(monkeypatch):
    for var in ("RUNNER_ROOT", "RUNNER_WORKERS", "PULUMI_BIN", "RUNNER_TIMEOUT_SECONDS",
                "RUNNER_LOG_LINES", "PULUMI_BACKEND_URL", "PULUMI_CONFIG_PASSPHRASE"):
        monkeypatch.delenv(var, raising=False)
    s = RunnerSettings()
    assert s.root == f"{tempfile.gettempdir()}/argon-runs"
    assert s.workers == 1
    assert s.pulumi_bin == "pulumi"
    assert s.timeout_seconds == 1800
    assert s.log_lines == 500
    assert s.backend_url.startswith("file://")
    assert s.passphrase == ""


def test_from_env(monkeypatch):
    monkeypatch.setenv("RUNNER_ROOT", "/tmp/custom-runs")
    monkeypatch.setenv("RUNNER_WORKERS", "4")
    monkeypatch.setenv("PULUMI_BIN", "/usr/bin/pulumi")
    monkeypatch.setenv("RUNNER_TIMEOUT_SECONDS", "60")
    monkeypatch.setenv("RUNNER_LOG_LINES", "10")
    monkeypatch.setenv("PULUMI_BACKEND_URL", "s3://bucket")
    monkeypatch.setenv("PULUMI_CONFIG_PASSPHRASE", "pw")
    s = RunnerSettings()
    assert s.root == "/tmp/custom-runs"
    assert s.workers == 4
    assert s.pulumi_bin == "/usr/bin/pulumi"
    assert s.timeout_seconds == 60
    assert s.log_lines == 10
    assert s.backend_url == "s3://bucket"
    assert s.passphrase == "pw"
