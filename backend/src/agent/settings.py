import os
import secrets
import tempfile
from dataclasses import dataclass, field


def env(name: str, default: str) -> str:
    return os.environ.get(name, default)


@dataclass(frozen=True)
class AgentSettings:
    groq_api_key: str = field(default_factory=lambda: env("GROQ_API_KEY", ""))
    groq_base_url: str = field(default_factory=lambda: env("GROQ_BASE_URL", "https://api.groq.com/openai/v1"))
    model_id: str = field(default_factory=lambda: env("GROQ_MODEL", "openai/gpt-oss-120b"))
    max_tokens: int = field(default_factory=lambda: int(env("AGENT_MAX_TOKENS", "8000")))
    session_dir: str = field(default_factory=lambda: env("SESSION_DIR", f"{tempfile.gettempdir()}/argon-sessions"))
    session_secret: str = field(default_factory=lambda: env("SESSION_SECRET", "") or secrets.token_urlsafe(32))
    session_ttl_seconds: int = field(default_factory=lambda: int(env("SESSION_TTL_SECONDS", str(24 * 3600))))
