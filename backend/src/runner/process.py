import os
import subprocess
import threading
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path

from runner.schemas import AwsCredentials, RunCreate
from runner.settings import RunnerSettings


def build_env(settings: RunnerSettings, region: str, credentials: AwsCredentials | None) -> dict[str, str]:
    env = dict(os.environ)
    env["AWS_REGION"] = region
    env["AWS_DEFAULT_REGION"] = region
    env["PULUMI_BACKEND_URL"] = settings.backend_url
    env["PULUMI_CONFIG_PASSPHRASE"] = settings.passphrase
    env["PULUMI_SKIP_UPDATE_CHECK"] = "true"
    if credentials is not None:
        env["AWS_ACCESS_KEY_ID"] = credentials.access_key_id
        env["AWS_SECRET_ACCESS_KEY"] = credentials.secret_access_key
        if credentials.session_token is not None:
            env["AWS_SESSION_TOKEN"] = credentials.session_token
    return env


def build_command(settings: RunnerSettings, stack: str) -> list[str]:
    return [settings.pulumi_bin, "up", "--yes", "--non-interactive", "--stack", stack, "--skip-preview"]


@dataclass
class PulumiJob:
    folder: str
    path: Path
    cmd: list[str]
    env: dict[str, str]
    timeout: float
    process: subprocess.Popen | None = field(default=None, init=False)
    timed_out: bool = field(default=False, init=False)
    _timer: threading.Timer | None = field(default=None, init=False, repr=False)

    def start(self) -> None:
        self.process = subprocess.Popen(
            self.cmd,
            cwd=self.path,
            env=self.env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        self._timer = threading.Timer(self.timeout, self._on_timeout)
        self._timer.daemon = True
        self._timer.start()

    def _on_timeout(self) -> None:
        self.timed_out = True
        self.kill()

    def stream(self) -> Iterator[str]:
        assert self.process is not None and self.process.stdout is not None
        for line in self.process.stdout:
            yield line.rstrip("\n")

    def wait(self) -> int:
        assert self.process is not None
        code = self.process.wait()
        if self._timer is not None:
            self._timer.cancel()
        return code

    def kill(self) -> None:
        if self.process is None:
            return
        self.process.terminate()
        try:
            self.process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            self.process.kill()


def start_pulumi_up(path: Path, req: RunCreate, settings: RunnerSettings) -> PulumiJob:
    return PulumiJob(
        folder=path.name,
        path=path,
        cmd=build_command(settings, req.stack),
        env=build_env(settings, req.region, req.credentials),
        timeout=settings.timeout_seconds,
    )
