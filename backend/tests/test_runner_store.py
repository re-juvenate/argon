import threading

import pytest

from runner.schemas import RunStatus
from runner.store import StatusStore


def test_create_and_get():
    store = StatusStore(log_lines=10)
    record = store.create(folder="f1", path="/tmp/f1")
    assert record.folder == "f1"
    assert record.path == "/tmp/f1"
    assert record.status is RunStatus.queued
    assert record.exit_code is None
    assert record.error is None
    assert store.get("f1") is record


def test_get_unknown_returns_none():
    store = StatusStore(log_lines=10)
    assert store.get("nope") is None


def test_list_returns_all_records():
    store = StatusStore(log_lines=10)
    store.create(folder="f1", path="/tmp/f1")
    store.create(folder="f2", path="/tmp/f2")
    assert {r.folder for r in store.list()} == {"f1", "f2"}


def test_set_status_updates_fields():
    store = StatusStore(log_lines=10)
    store.create(folder="f1", path="/tmp/f1")
    store.set_status("f1", RunStatus.failed, exit_code=1, error="boom")
    record = store.get("f1")
    assert record.status is RunStatus.failed
    assert record.exit_code == 1
    assert record.error == "boom"


def test_set_status_unknown_folder_is_noop():
    store = StatusStore(log_lines=10)
    store.set_status("nope", RunStatus.failed)


def test_append_log_and_read_logs():
    store = StatusStore(log_lines=3)
    store.create(folder="f1", path="/tmp/f1")
    store.append_log("f1", "line1")
    store.append_log("f1", "line2")
    assert store.logs("f1") == ["line1", "line2"]


def test_append_log_ring_buffer_drops_oldest():
    store = StatusStore(log_lines=3)
    store.create(folder="f1", path="/tmp/f1")
    for i in range(5):
        store.append_log("f1", f"line{i}")
    assert store.logs("f1") == ["line2", "line3", "line4"]


def test_append_log_unknown_folder_is_noop():
    store = StatusStore(log_lines=3)
    store.append_log("nope", "x")


def test_logs_unknown_folder_returns_empty():
    store = StatusStore(log_lines=3)
    assert store.logs("nope") == []


def test_concurrent_creates_are_consistent():
    store = StatusStore(log_lines=10)

    def worker(i):
        store.create(folder=f"f{i}", path=f"/tmp/f{i}")

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(50)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(store.list()) == 50
