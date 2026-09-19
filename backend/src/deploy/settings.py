import os
from dataclasses import dataclass, field


def env(name: str, default: str) -> str:
    return os.environ.get(name, default)


@dataclass(frozen=True)
class Settings:
    pulumi_backend_url: str = field(default_factory=lambda: env("PULUMI_BACKEND_URL", "file://~"))
    pulumi_config_passphrase: str = field(default_factory=lambda: env("PULUMI_CONFIG_PASSPHRASE", ""))
    pulumi_project: str = field(default_factory=lambda: env("PULUMI_PROJECT", "argon"))
    pulumi_home: str | None = field(default_factory=lambda: os.environ.get("PULUMI_HOME"))
