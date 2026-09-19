# LLM-authored Pulumi runner: temp workspace → subprocess → job queue → consumer

## Context

`backend/src/` already has a typed deploy path (`deploy/`, merged): fixed EC2/App Runner/CloudFront programs driven by the Pulumi **Automation API** in-process. That path only builds infra we modelled ahead of time.

This adds the **freeform** path: an LLM writes arbitrary Pulumi Python files into a scratch directory, and the backend runs `pulumi up` on that directory as a **subprocess**, through a job queue with a consumer that watches the pipe and records per-folder status. It lands as a new sibling module `src/runner/`; `deploy/` is untouched and keeps working.

Confirmed with the user: new sibling module `runner/`; workspace tool returns a path **and** a write-files helper (HTTP callers don't need disk access); credentials from server env with optional per-request override; in-process `queue.Queue` + N worker threads behind a swappable `JobQueue` protocol so SQS can drop in later.

### One deliberate refinement — please sanity-check

The sketch says *tool func 2 creates the subprocess pipe object, then puts it in the queue*. Taken literally, `Popen` starts at enqueue time, so every job is already running in parallel and the queue only gates *monitoring*, never execution — the worker count would do nothing.

So `start_pulumi_up(...)` returns a **lazy** `PulumiJob` holding cmd + env + cwd; the queue carries that job, and the **consumer** calls `.start()` and attaches to the pipe. Same four moving parts, same consumer-attaches-to-pipe shape, but the queue actually serialises runs — and an SQS queue can only carry a serialisable payload anyway, never a live `Popen`. Say the word if you want literal eager `Popen` instead.

## Layout

```
src/runner/
  __init__.py
  schemas.py       # AwsCredentials, RunCreate, RunRead, WorkspaceRead, RunStatus
  settings.py      # RunnerSettings from env
  workspace.py     # tool func 1: create_workspace / write_files / ensure_project_file
  process.py       # tool func 2: build_env / build_command / start_pulumi_up -> PulumiJob
  queue.py         # JobQueue protocol + InMemoryJobQueue (queue.Queue)
  consumer.py      # worker threads: attach to pipe, stream, set terminal status
  store.py         # StatusStore: folder -> RunRecord (the folder | status table)
  service.py       # RunnerService wiring the above
  dependencies.py  # get_runner_settings / get_runner_service (lru_cache)
  router.py        # /runs endpoints
tests/
  test_runner_schemas.py  test_runner_workspace.py  test_runner_process.py
  test_runner_queue.py    test_runner_store.py      test_runner_consumer.py
  test_runner_service.py  test_runner_router.py
```

Follows the existing module shape (`agent/`, `deploy/`): router → dependencies → service → schemas, in-memory store, few comments. `runner/settings.py` re-declares the 2-line `env()` helper rather than importing from `deploy.settings` — duplicating two trivial lines beats coupling two independent modules.

## Step 1 — `schemas.py`

```python
class RunStatus(str, Enum): queued, running, succeeded, failed, timed_out

class AwsCredentials(BaseModel):
    access_key_id: str; secret_access_key: str
    session_token: str | None = None          # excluded from every response model

class RunCreate(BaseModel):
    files: dict[str, str]                      # filename -> content
    folder: str | None = None                  # reuse an existing workspace
    project: str = Field("argon-run", pattern=r"^[a-zA-Z][\w.-]*$", max_length=100)
    stack: str = Field("dev", pattern=r"^[a-zA-Z0-9][\w.-]*$", max_length=100)
    region: str = "us-east-1"
    credentials: AwsCredentials | None = None

class RunRead(BaseModel):                      # never carries credentials
    folder: str; path: str; status: RunStatus
    exit_code: int | None = None; error: str | None = None
```

Validators on `files`: non-empty, must contain `__main__.py`, at most `MAX_FILES` (50), each name ≤255 chars and free of `/`, `\`, `..`, leading `~` or absolute paths, each body ≤1 MiB and total ≤10 MiB.

## Step 2 — `settings.py`

`RunnerSettings(frozen dataclass)`: `root` (`RUNNER_ROOT`, default `<tmp>/argon-runs`), `workers` (`RUNNER_WORKERS`, 1), `pulumi_bin` (`PULUMI_BIN`, `pulumi`), `timeout_seconds` (`RUNNER_TIMEOUT_SECONDS`, 1800), `log_lines` (`RUNNER_LOG_LINES`, 500), `backend_url` (`PULUMI_BACKEND_URL`), `passphrase` (`PULUMI_CONFIG_PASSPHRASE`).

`pulumi_bin` being configurable is what lets the whole subprocess layer be tested without the Pulumi CLI (not installed on this machine).

## Step 3 — `workspace.py` (tool func 1)

- `create_workspace(settings) -> Path` — `mkdtemp(prefix="run-", dir=settings.root)`, root created if missing. Folder name is the status-table key.
- `resolve_workspace(folder, settings) -> Path` — rejects a folder that escapes `root`; raises `ValueError` if absent.
- `write_files(path, files) -> list[str]` — re-checks each name and asserts `(path/name).resolve().is_relative_to(path.resolve())` before writing; traversal raises `ValueError`.
- `ensure_project_file(path, project)` — writes `Pulumi.yaml` (`name`, `runtime: python`) only when the LLM didn't supply one.

## Step 4 — `process.py` (tool func 2)

- `build_env(settings, region, credentials) -> dict` — `os.environ` copy + `AWS_REGION`/`AWS_DEFAULT_REGION`, `PULUMI_BACKEND_URL`, `PULUMI_CONFIG_PASSPHRASE`, `PULUMI_SKIP_UPDATE_CHECK=true`; overlays `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_SESSION_TOKEN` only when `credentials` is given (session token omitted when `None`).
- `build_command(settings, stack) -> list[str]` — `[pulumi_bin, "up", "--yes", "--non-interactive", "--stack", stack, "--skip-preview"]`.
- `PulumiJob` dataclass — `folder`, `path`, `cmd`, `env`, `timeout`; `start()` opens `Popen(cwd=path, stdout=PIPE, stderr=STDOUT, text=True)`; `stream()` yields lines; `wait()` returns the exit code; `kill()` terminates then kills on timeout.
- `start_pulumi_up(path, payload, settings) -> PulumiJob` — builds the job (lazy, see refinement note above).
- Stack creation: the command carries `--stack`, and `PULUMI_STACK` plus a `pulumi stack select --create` preflight runs inside `PulumiJob.start()` as a short blocking call so the queue still holds exactly one job object.

## Step 5 — `queue.py`, `store.py`, `consumer.py`

- `JobQueue` Protocol: `put(job)`, `get(timeout) -> job | None`, `task_done()`. `InMemoryJobQueue` wraps `queue.Queue`; `get` returns `None` on empty-timeout so workers stay responsive to shutdown.
- `StatusStore` — `dict[str, RunRecord]` guarded by `threading.Lock` (consumer threads write while request threads read). `RunRecord` holds folder, path, status, exit_code, error and a `deque(maxlen=settings.log_lines)` of output. Methods: `create`, `get`, `list`, `set_status`, `append_log`, `logs`.
- `Consumer(queue, store, workers)` — `start()` spawns daemon threads; each loops `get` → `set_status(running)` → `job.start()` → stream lines into the store → `wait()` → `succeeded` on 0, `failed` with `exit_code` otherwise; timeout → `kill()` + `timed_out`; any exception → `failed` with `str(exc)`. `stop()` sets an event, pushes sentinels, joins with timeout.

## Step 6 — `service.py`, `dependencies.py`, `router.py`, lifespan

`RunnerService(settings, store, queue, workspace=workspace, process=process)`:
- `create_workspace() -> WorkspaceRead` — tool func 1 over HTTP.
- `submit(payload) -> RunRead` — resolve-or-create folder → `write_files` → `ensure_project_file` → `store.create(queued)` → `start_pulumi_up` → `queue.put`.
- `get(folder)`, `list()`, `logs(folder)`.

Router `/runs`: `POST /runs/workspaces` → 201 `WorkspaceRead`; `POST /runs/` → 202 `RunRead`; `GET /runs/{folder}` → 404 when unknown; `GET /runs/` → the folder|status table; `GET /runs/{folder}/logs` → captured tail. Unknown/escaping folder on submit → 400.

`main.py` gains a `lifespan` that starts the consumer on startup and stops it on shutdown, then `app.include_router(runner_router)`.

## Step 7 — Tests (TDD, ≥95% — previous module hit 100%)

Subprocess layers are driven by pointing `pulumi_bin` at real fake binaries (`/bin/true`, `/bin/false`, `python -c` scripts that print N lines or sleep), so `process.py` and `consumer.py` get genuine coverage without the Pulumi CLI.

- **schemas**: empty `files`, missing `__main__.py`, 51 files, 256-char name, 1 MiB + 1 body, total over 10 MiB, names `../x.py` / `/etc/passwd` / `a/b.py` / `""` / `~/x.py`, bad stack & project patterns, credentials absent from `RunRead`.
- **workspace**: root auto-created, unique folder names, files written verbatim, traversal raises, `ensure_project_file` writes only when absent and preserves an LLM-supplied `Pulumi.yaml`, `resolve_workspace` rejects escape and missing dirs.
- **process**: env carries region/backend/passphrase, credentials overlaid, session token omitted when `None`, server env inherited, command shape, `start`/`stream`/`wait` on success + non-zero exit, multi-line streaming, timeout kills.
- **queue**: FIFO, `get` timeout → `None`, sentinel unblocks, `task_done` pairing.
- **store**: create/get/list/set_status, unknown folder → `None`, **log ring-buffer overflow drops oldest**, concurrent writes from threads stay consistent.
- **consumer**: exit 0 → succeeded; exit 1 → failed with `exit_code`; `start()` raising → failed with message; sleeper → timed_out; drains several jobs; `stop()` joins cleanly.
- **service**: submit creates + writes + enqueues, reuse-existing-folder path, unknown folder → `ValueError`, list is the folder|status table.
- **router**: 201/202/404/400/422, logs endpoint, list endpoint, credentials never echoed back, consumer driven synchronously via a fake queue for determinism.

## Verification

1. `cd backend && uv run pytest --cov=src --cov-report=term-missing` — all green, ≥95%.
2. `uv run uvicorn main:app --app-dir src` boots; `/docs` lists `/agents`, `/deployments`, `/runs`.
3. Fake-CLI end-to-end: `PULUMI_BIN=/bin/true`, POST a `__main__.py`, poll `GET /runs/{folder}` until `succeeded`; repeat with `/bin/false` → `failed`, exit_code 1.
4. Real run (needs the Pulumi CLI — **not installed here** — plus AWS creds): POST a real program, watch `GET /runs/{folder}/logs` stream, confirm `succeeded`.

## Notes

- Switch to Sonnet before implementation — I can't change models myself, run `/model sonnet`.
- TDD per superpowers; commits signed with the `_gh` SSH key; no Claude attribution in git content (global CLAUDE.md).
- Workspaces are deliberately **not** deleted after a run — the local Pulumi backend keeps stack state there, needed for any later destroy. A reaper is out of scope for this change.
