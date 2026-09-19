import os
import tempfile
from dataclasses import dataclass, field


def env(name: str, default: str) -> str:
    return os.environ.get(name, default)


@dataclass(frozen=True)
class RunnerSettings:
    root: str = field(default_factory=lambda: env("RUNNER_ROOT", f"{tempfile.gettempdir()}/argon-runs"))
    workers: int = field(default_factory=lambda: int(env("RUNNER_WORKERS", "1")))
    pulumi_bin: str = field(default_factory=lambda: env("PULUMI_BIN", "pulumi"))
    timeout_seconds: int = field(default_factory=lambda: int(env("RUNNER_TIMEOUT_SECONDS", "1800")))
    log_lines: int = field(default_factory=lambda: int(env("RUNNER_LOG_LINES", "500")))
    backend_url: str = field(default_factory=lambda: env("PULUMI_BACKEND_URL", "file://~"))
    passphrase: str = field(default_factory=lambda: env("PULUMI_CONFIG_PASSPHRASE", ""))
