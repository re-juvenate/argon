import threading

from runner.queue import JobQueue
from runner.schemas import RunStatus
from runner.store import StatusStore

POLL_TIMEOUT = 0.5


class Consumer:
    def __init__(self, job_queue: JobQueue, store: StatusStore, workers: int = 1) -> None:
        self.queue = job_queue
        self.store = store
        self.workers = workers
        self._stop_event = threading.Event()
        self._threads: list[threading.Thread] = []

    def start(self) -> None:
        for _ in range(self.workers):
            thread = threading.Thread(target=self._run, daemon=True)
            thread.start()
            self._threads.append(thread)

    def stop(self, timeout: float = 5) -> None:
        self._stop_event.set()
        for thread in self._threads:
            thread.join(timeout=timeout)
        self._threads.clear()

    def _run(self) -> None:
        while not self._stop_event.is_set():
            job = self.queue.get(timeout=POLL_TIMEOUT)
            if job is None:
                continue
            self._process(job)
            self.queue.task_done()

    def _process(self, job) -> None:
        self.store.set_status(job.folder, RunStatus.running)
        try:
            job.start()
            for line in job.stream():
                self.store.append_log(job.folder, line)
            exit_code = job.wait()
        except Exception as exc:
            self.store.set_status(job.folder, RunStatus.failed, error=str(exc))
            return
        if job.timed_out:
            self.store.set_status(job.folder, RunStatus.timed_out, exit_code=exit_code)
        elif exit_code == 0:
            self.store.set_status(job.folder, RunStatus.succeeded, exit_code=exit_code)
        else:
            self.store.set_status(job.folder, RunStatus.failed, exit_code=exit_code)
