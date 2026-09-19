import threading
import time

from runner.queue import InMemoryJobQueue


def test_fifo_order():
    q = InMemoryJobQueue()
    q.put("a")
    q.put("b")
    q.put("c")
    assert [q.get(timeout=1), q.get(timeout=1), q.get(timeout=1)] == ["a", "b", "c"]


def test_get_returns_none_on_empty_timeout():
    q = InMemoryJobQueue()
    start = time.monotonic()
    assert q.get(timeout=0.1) is None
    assert time.monotonic() - start < 2


def test_task_done_does_not_raise():
    q = InMemoryJobQueue()
    q.put("a")
    q.get(timeout=1)
    q.task_done()


def test_put_unblocks_waiting_get():
    q = InMemoryJobQueue()
    results = []

    def waiter():
        results.append(q.get(timeout=5))

    t = threading.Thread(target=waiter)
    t.start()
    time.sleep(0.05)
    q.put("job")
    t.join(timeout=2)
    assert results == ["job"]
