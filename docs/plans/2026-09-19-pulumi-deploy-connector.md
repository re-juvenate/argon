# Pulumi deploy connector for the FastAPI backend

## Context

`backend/` is a small FastAPI service (`agent/` module: router → dependencies → service → schemas, in-memory store). The user wants:

1. A Pulumi **connector/anchor** that can stand up **EC2 or App Runner**, optionally fronted by **CloudFront**.
2. A FastAPI endpoint that triggers the Pulumi deployment (async job, plus a destroy endpoint).
3. Clean functions, few comments, same module layout as `agent/`.
4. Flatten `backend/src/backend/` → `backend/src/` (package root becomes `src/`).

Decisions confirmed with the user: Pulumi **Automation API with inline program**; **async job** (202 + id, background task, poll GET); **state backend configurable via env, default local file**; request = target + options + `cloudfront` flag, **and** a `DELETE` destroy endpoint.

Note: `pulumi` CLI is not installed on this machine. Automation API needs the binary at runtime; unit tests must not depend on it (mock `pulumi.automation`, use `pulumi.runtime.set_mocks` for programs). Dockerfile installs the CLI.

## Layout after change

```
backend/
  pyproject.toml           # no build-system, package=false, new deps, pytest config
  Dockerfile               # COPY src ./src, install pulumi CLI, uvicorn main:app --app-dir src
  src/
    main.py                # from agent.router import ..., from deploy.router import ...
    agent/                 # moved as-is; imports become `from agent.x import ...`
    deploy/
      __init__.py
      router.py            # /deployments endpoints
      schemas.py           # request/response models
      service.py           # DeploymentService: job store + run/destroy orchestration
      dependencies.py      # get_deployment_service (lru_cache), get_settings
      settings.py          # env: PULUMI_BACKEND_URL, PULUMI_CONFIG_PASSPHRASE, AWS_REGION default, PULUMI_PROJECT
      pulumi/
        __init__.py
        workspace.py       # create_or_select_stack wrapper, build LocalWorkspaceOptions, run up/destroy
        program.py         # build_program(request) -> callable that wires ec2/apprunner + cloudfront
        ec2.py             # security group + instance; returns public dns / ip
        apprunner.py       # aws.apprunner.Service from image; returns service url
        cloudfront.py      # Distribution over an origin domain; returns domain
  tests/
    conftest.py
    test_agent_router.py   # existing behaviour, kept green after move
    test_deploy_schemas.py
    test_deploy_service.py
    test_deploy_router.py
    test_pulumi_workspace.py
    test_pulumi_programs.py  # pulumi.runtime.set_mocks for ec2/apprunner/cloudfront/program
```

## Step 1 — Flatten the package

- `git mv backend/src/backend/* backend/src/` and delete `src/backend/__init__.py` (the `main()` hello stub is unused).
- Rewrite imports `backend.agent.` → `agent.`.
- `pyproject.toml`: remove `[build-system]` and `[project.scripts]`; add `[tool.uv] package = false`; add deps `pulumi>=3`, `pulumi-aws>=6`; add `[dependency-groups] dev = ["pytest", "pytest-cov", "httpx"]`; add `[tool.pytest.ini_options] pythonpath = ["src"]` and `[tool.coverage.run] source = ["src"]`.
- `Dockerfile`: `COPY src ./src`; install pulumi CLI (`curl -fsSL https://get.pulumi.com | sh` and add `/root/.pulumi/bin` to PATH); `CMD ["uvicorn", "main:app", "--app-dir", "src", "--host", "0.0.0.0", "--port", "8000"]`.
- `uv lock`, `uv run pytest`.

## Step 2 — `deploy/schemas.py`

```python
class Target(str, Enum): ec2 = "ec2"; apprunner = "apprunner"

class Ec2Options(BaseModel):
    instance_type: str = "t3.micro"
    ami: str | None = None          # default: latest Amazon Linux 2023 via aws.ec2.get_ami
    user_data: str | None = None
    port: int = Field(80, ge=1, le=65535)

class AppRunnerOptions(BaseModel):
    image: str                       # ECR public/private image identifier
    port: int = Field(8080, ge=1, le=65535)
    cpu: str = "1024"
    memory: str = "2048"

class DeploymentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40, pattern=r"^[a-z][a-z0-9-]*$")
    region: str = "us-east-1"
    target: Target
    ec2: Ec2Options | None = None
    apprunner: AppRunnerOptions | None = None
    cloudfront: bool = False
    # model_validator: the options block matching `target` must be present

class DeploymentStatus(str, Enum): pending, running, succeeded, failed, destroying, destroyed

class DeploymentRead(BaseModel):
    id: int; name: str; target: Target; status: DeploymentStatus
    outputs: dict[str, str] = {}; error: str | None = None
```

## Step 3 — `deploy/pulumi/*`

- `ec2.py::create_instance(name, opts: Ec2Options) -> aws.ec2.Instance` — SG allowing `opts.port` + egress, `get_ami` lookup when `ami` is None. Export helper returns `{"origin_domain": instance.public_dns, "url": ...}`.
- `apprunner.py::create_service(name, opts) -> aws.apprunner.Service` — `ImageRepository` source, public ECR unless image contains `.dkr.ecr.` (then `image_repository_type="ECR"` and an access role). Returns `service_url`.
- `cloudfront.py::create_distribution(name, origin_domain: Output[str]) -> aws.cloudfront.Distribution` — single custom origin (http-only, matching port), `allow-all` viewer policy, default cache behaviour, `CloudFront-Default-Certificate`, no geo restriction.
- `program.py::build_program(req: DeploymentCreate) -> Callable[[], None]` — picks target, optionally wraps in CloudFront, `pulumi.export("url", ...)`, `pulumi.export("origin", ...)`, `pulumi.export("cloudfront_domain", ...)` when enabled.
- `workspace.py`:
  - `stack_name(req)`, `workspace_options(settings) -> auto.LocalWorkspaceOptions` (project settings with `runtime="python"`, backend url, env vars for passphrase).
  - `select_stack(req, settings) -> auto.Stack` via `auto.create_or_select_stack(...)` + `set_config("aws:region", ...)`.
  - `up(stack) -> dict[str,str]` (maps `result.outputs` values), `destroy(stack)` then `stack.workspace.remove_stack(...)`.

## Step 4 — `deploy/service.py`

`DeploymentService(settings, runner=workspace)` mirroring `AgentService`: in-memory `dict[int, DeploymentRead]`, `create(payload)` stores `pending` and returns record; `run(id, payload)` (called from `BackgroundTasks`) sets `running` → `up` → `succeeded` + outputs, or `failed` + `error=str(exc)`; `destroy(id)` sets `destroying` → `destroyed`/`failed`; `get`, `list`. Keep the payloads in a side dict so destroy can rebuild the stack. Guard: destroy on `pending`/`running` raises `ValueError` → 409 in router.

## Step 5 — `deploy/router.py`

- `POST /deployments/` → 202, `DeploymentRead`; schedules `service.run` via `BackgroundTasks`.
- `GET /deployments/{id}` → 404 if missing.
- `GET /deployments/` → list.
- `DELETE /deployments/{id}` → 202, schedules `service.destroy`; 404 / 409.
- `main.py` includes both routers.

## Step 6 — Tests (>95% coverage, edge cases)

- Schemas: name pattern/length bounds (empty, 41 chars, uppercase, leading digit), port 0 / 65536 / valid, missing options for chosen target, mismatched options ignored/rejected, defaults.
- Programs: `pulumi.runtime.set_mocks` with a `Mocks` class; assert resources created, SG ingress port, AMI lookup skipped when `ami` given, ECR vs public repo type, CloudFront origin wiring, exports present/absent per `cloudfront` flag.
- Workspace: monkeypatch `pulumi.automation.create_or_select_stack`; assert backend url/env/passphrase/region config, `up` output mapping (secrets & non-str values), `destroy` removes stack, exceptions propagate.
- Service: happy path per target, `up` raising → `failed` with message, destroy on running → `ValueError`, destroy on unknown → `None`, list order, counter increments.
- Router: `TestClient` with overridden `get_deployment_service`; 202/404/409/422 paths; background task actually invoked (use a fake runner).
- Agent tests: existing endpoints still pass after the move.

Run: `cd backend && uv run pytest --cov=src --cov-report=term-missing` — target ≥95%.

## Verification

1. `uv run pytest --cov` green, coverage ≥95%.
2. `uv run uvicorn main:app --app-dir src` starts; `/docs` shows `/agents` and `/deployments`.
3. `docker build backend` succeeds (pulumi CLI present in image).
4. Manual (needs AWS creds + pulumi CLI): `POST /deployments/` with `{"name":"demo","target":"ec2","ec2":{},"cloudfront":true}` → poll GET until `succeeded`, `outputs.url` resolves; `DELETE` → `destroyed`.

## Notes for execution

- User asked to switch to Sonnet (medium) after planning: run `/model sonnet` before starting implementation.
- Follow TDD per superpowers; no Claude attribution in commits (global CLAUDE.md overrides).
