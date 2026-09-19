import sys
import time

import pytest

from runner.consumer import Consumer
from runner.process import PulumiJob
from runner.queue import InMemoryJobQueue
from runner.schemas import RunStatus
from runner.store import StatusStore


def python_script(body: str) -> list[str]:
    return [sys.executable, "-c", body]


def make_job(tmp_path, body, timeout=5, folder="f1"):
    return PulumiJob(folder=folder, path=tmp_path, cmd=python_script(body), env={"PATH": "/usr/bin:/bin"}, timeout=timeout)


@pytest.fixture
def store():
    return StatusStore(log_lines=50)


@pytest.fixture
def job_queue():
    return InMemoryJobQueue()


def wait_for(predicate, timeout=5):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.02)
    return False


def test_successful_job_marked_succeeded(tmp_path, store, job_queue):
    store.create(folder="f1", path=str(tmp_path))
    job_queue.put(make_job(tmp_path, "print('ok')"))
    consumer = Consumer(job_queue, store, workers=1)
    consumer.start()
    try:
        assert wait_for(lambda: store.get("f1").status == RunStatus.succeeded)
        assert store.get("f1").exit_code == 0
        assert store.logs("f1") == ["ok"]
    finally:
        consumer.stop()


def test_failed_job_records_exit_code(tmp_path, store, job_queue):
    store.create(folder="f1", path=str(tmp_path))
    job_queue.put(make_job(tmp_path, "import sys; sys.exit(2)"))
    consumer = Consumer(job_queue, store, workers=1)
    consumer.start()
    try:
        assert wait_for(lambda: store.get("f1").status == RunStatus.failed)
        assert store.get("f1").exit_code == 2
    finally:
        consumer.stop()


def test_start_raising_records_failure(tmp_path, store, job_queue):
    store.create(folder="f1", path=str(tmp_path))
    job = make_job(tmp_path, "print(1)")
    job.cmd = ["/no/such/binary"]
    job_queue.put(job)
    consumer = Consumer(job_queue, store, workers=1)
    consumer.start()
    try:
        assert wait_for(lambda: store.get("f1").status == RunStatus.failed)
        assert store.get("f1").error
    finally:
        consumer.stop()


def test_timeout_job_marked_timed_out(tmp_path, store, job_queue):
    store.create(folder="f1", path=str(tmp_path))
    job_queue.put(make_job(tmp_path, "import time; time.sleep(30)", timeout=0.2))
    consumer = Consumer(job_queue, store, workers=1)
    consumer.start()
    try:
        assert wait_for(lambda: store.get("f1").status == RunStatus.timed_out, timeout=5)
    finally:
        consumer.stop()


def test_job_set_to_running_before_completion(tmp_path, store, job_queue):
    store.create(folder="f1", path=str(tmp_path))
    job_queue.put(make_job(tmp_path, "import time; time.sleep(0.3); print('done')"))
    consumer = Consumer(job_queue, store, workers=1)
    consumer.start()
    try:
        assert wait_for(lambda: store.get("f1").status == RunStatus.running, timeout=2)
    finally:
        consumer.stop()


def test_drains_multiple_jobs(tmp_path, store, job_queue):
    for i in range(3):
        folder = f"f{i}"
        store.create(folder=folder, path=str(tmp_path))
        job_queue.put(make_job(tmp_path, "print('x')", folder=folder))
    consumer = Consumer(job_queue, store, workers=2)
    consumer.start()
    try:
        assert wait_for(lambda: all(store.get(f"f{i}").status == RunStatus.succeeded for i in range(3)))
    finally:
        consumer.stop()


def test_stop_joins_cleanly(store, job_queue):
    consumer = Consumer(job_queue, store, workers=2)
    consumer.start()
    consumer.stop()
    for thread in consumer._threads:
        assert not thread.is_alive()
