import re
import time
from collections.abc import Callable
from typing import TypeVar

_RETRY_IN_RE = re.compile(r"try again in\s*((?:\d+(?:\.\d+)?(?:ms|s|m)\s*)+)", re.IGNORECASE)
_DURATION_PART_RE = re.compile(r"(\d+(?:\.\d+)?)(ms|s|m)", re.IGNORECASE)
_UNIT_SECONDS = {"ms": 0.001, "s": 1.0, "m": 60.0}

FALLBACK_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]

T = TypeVar("T")


class Throttled(Exception):
    def __init__(self, retry_after: float, message: str) -> None:
        super().__init__(message)
        self.retry_after = retry_after


def retry_after_seconds(error: BaseException, max_wait: float = 120.0) -> float | None:
    wait: float | None = None
    headers = getattr(getattr(error, "response", None), "headers", None)
    if headers:
        try:
            wait = float(headers.get("retry-after", ""))
        except (TypeError, ValueError):
            wait = None
    if wait is None:
        m = _RETRY_IN_RE.search(str(error))
        if m:
            wait = sum(float(v) * _UNIT_SECONDS[u.lower()] for v, u in _DURATION_PART_RE.findall(m.group(1)))
    if wait is None:
        return None
    return min(max_wait, wait + 0.5)


def is_daily_quota(error: BaseException) -> bool:
    text = str(error).lower()
    return "per day" in text and ("429" in text or "rate limit" in text)


def is_missing_model(error: BaseException) -> bool:
    text = str(error).lower()
    return "404" in text or "model_not_found" in text or "decommissioned" in text


def with_groq_retry(
    call: Callable[[str], T],
    models: list[str],
    is_throttle: Callable[[BaseException], bool],
    inline_wait: float = 8.0,
    sleep: Callable[[float], None] = time.sleep,
) -> T:
    last: BaseException | None = None
    for model in models:
        waited = False
        while True:
            try:
                return call(model)
            except Exception as error:
                last = error
                if is_missing_model(error):
                    break
                if not is_throttle(error):
                    raise
                if is_daily_quota(error):
                    raise Throttled(retry_after_seconds(error, max_wait=24 * 3600.0) or 3600.0, str(error)) from error
                wait = retry_after_seconds(error) or 3.5
                if waited or wait > inline_wait:
                    raise Throttled(wait, str(error)) from error
                sleep(wait)
                waited = True
    raise RuntimeError(f"no usable model: {last}")
