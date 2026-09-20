import pytest

from agent.groq import Throttled, is_daily_quota, retry_after_seconds, with_groq_retry


class Resp:
    def __init__(self, headers):
        self.headers = headers


class Err(Exception):
    def __init__(self, message, headers=None):
        super().__init__(message)
        self.response = Resp(headers) if headers is not None else None


def test_retry_after_from_header():
    assert retry_after_seconds(Err("429", {"retry-after": "7"})) == 7.5


def test_retry_after_from_message_units():
    assert retry_after_seconds(Err("Rate limit reached. Please try again in 12.3s.")) == pytest.approx(12.8)
    assert retry_after_seconds(Err("try again in 850ms")) == pytest.approx(1.35)
    assert retry_after_seconds(Err("try again in 1m2.5s")) == pytest.approx(63.0)


def test_retry_after_capped_and_none():
    assert retry_after_seconds(Err("try again in 10m"), max_wait=120) == 120
    assert retry_after_seconds(Err("boom")) is None


def test_daily_quota_detection():
    assert is_daily_quota(Err("429 rate limit: tokens per day exceeded"))
    assert not is_daily_quota(Err("429 tokens per minute"))


def throttle(e):
    return "429" in str(e)


def test_short_throttle_waits_once_then_succeeds():
    calls, slept = [], []

    def call(model):
        calls.append(model)
        if len(calls) == 1:
            raise Err("429 try again in 2s")
        return f"ok:{model}"

    assert with_groq_retry(call, ["a", "b"], throttle, sleep=slept.append) == "ok:a"
    assert calls == ["a", "a"]
    assert slept == [pytest.approx(2.5)]


def test_long_throttle_raises_with_retry_after():
    def call(model):
        raise Err("429 try again in 30s")

    with pytest.raises(Throttled) as info:
        with_groq_retry(call, ["a"], throttle, sleep=lambda s: None)
    assert info.value.retry_after == pytest.approx(30.5)


def test_second_throttle_raises_instead_of_looping():
    slept = []

    def call(model):
        raise Err("429 try again in 1s")

    with pytest.raises(Throttled):
        with_groq_retry(call, ["a"], throttle, sleep=slept.append)
    assert len(slept) == 1


def test_daily_quota_raises_long_retry():
    def call(model):
        raise Err("429 rate limit: tokens per day, try again in 2h")

    with pytest.raises(Throttled) as info:
        with_groq_retry(call, ["a", "b"], throttle, sleep=lambda s: None)
    assert info.value.retry_after == 3600.0


def test_missing_model_falls_back():
    calls = []

    def call(model):
        calls.append(model)
        if model == "a":
            raise Err("404 model_not_found")
        return model

    assert with_groq_retry(call, ["a", "b"], throttle, sleep=lambda s: None) == "b"
    assert calls == ["a", "b"]


def test_all_models_missing_is_runtime_error():
    def call(model):
        raise Err("404 decommissioned")

    with pytest.raises(RuntimeError, match="no usable model"):
        with_groq_retry(call, ["a", "b"], throttle, sleep=lambda s: None)


def test_other_errors_propagate():
    def call(model):
        raise ValueError("bad")

    with pytest.raises(ValueError):
        with_groq_retry(call, ["a"], throttle, sleep=lambda s: None)
