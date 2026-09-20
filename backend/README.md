# backend

FastAPI service with a Pulumi connector that deploys EC2 or App Runner, optionally behind CloudFront.

```sh
uv sync
uv run uvicorn main:app --app-dir src --reload
uv run pytest --cov=src
```

Requires the `pulumi` CLI and AWS credentials at runtime (the Dockerfile installs the CLI).

| Env var                   | Default    | Purpose                              |
| ------------------------- | ---------- | ------------------------------------ |
| `PULUMI_BACKEND_URL`      | `file://~` | State backend (local file, S3, cloud) |
| `PULUMI_CONFIG_PASSPHRASE`| `""`       | Secrets passphrase for file backends  |
| `PULUMI_PROJECT`          | `argon`    | Pulumi project name                   |
| `PULUMI_HOME`             | unset      | Pulumi home dir override              |

```sh
curl -X POST localhost:8000/deployments/ -H 'content-type: application/json' \
  -d '{"name":"demo","target":"ec2","ec2":{"port":80},"cloudfront":true}'
curl localhost:8000/deployments/1
curl -X DELETE localhost:8000/deployments/1
```

## Graph completion (`/agent`)

Strands agent on Groq (OpenAI-compatible endpoint, strict JSON-schema
structured output — needs a model that supports it, `openai/gpt-oss-120b`
by default). Each browser gets a JWT session; the conversation is kept by
Strands' `FileSessionManager` under `SESSION_DIR`, so repeated completions
continue the same thread.

| Env var               | Default                              | Purpose                          |
| --------------------- | ------------------------------------ | -------------------------------- |
| `GROQ_API_KEY`        | unset                                | Groq key                         |
| `GROQ_MODEL`          | `openai/gpt-oss-120b`                | Must support strict json_schema  |
| `GROQ_BASE_URL`       | `https://api.groq.com/openai/v1`     |                                  |
| `SESSION_SECRET`      | random per process                   | JWT HMAC secret (set in prod)    |
| `SESSION_TTL_SECONDS` | `86400`                              |                                  |
| `SESSION_DIR`         | `<tmp>/argon-sessions`               | Strands session files            |
| `CORS_ORIGINS`        | `http://localhost:5173`              | Comma-separated                  |

```sh
curl -X POST localhost:8000/agent/session          # -> {token, session_id, expires_in}; also sets a `session` cookie
curl -X POST localhost:8000/agent/complete -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"graph":{"version":1,"nodes":[{"id":"c","service":"client","config":{},"position":{"x":0,"y":0}}],"edges":[]},"prompt":"add a web tier"}'
```

The response carries the merged `graph` plus `added.{nodes,edges}` (validated:
new ids only, edges between existing/new non-frame nodes, ASG members
edge-free) for the UI to overlay.

## Freeform runner (`/runs`)

For infra we didn't model ahead of time: write arbitrary Pulumi Python files
into a scratch workspace and run `pulumi up` on them as a subprocess, through
an in-process job queue and a background consumer that streams the process
output and records status per workspace.

| Env var                  | Default              | Purpose                          |
| ------------------------ | -------------------- | --------------------------------- |
| `RUNNER_ROOT`             | `<tmp>/argon-runs`   | Parent dir for run workspaces     |
| `RUNNER_WORKERS`          | `1`                  | Consumer worker threads           |
| `PULUMI_BIN`              | `pulumi`             | Path to the Pulumi CLI binary     |
| `RUNNER_TIMEOUT_SECONDS`  | `1800`               | Kill a run after this long        |
| `RUNNER_LOG_LINES`        | `500`                | Captured log lines per run (ring buffer) |

```sh
curl -X POST localhost:8000/runs/ -H 'content-type: application/json' \
  -d '{"files":{"__main__.py":"import pulumi\npulumi.export(\"ok\", True)"}}'
curl localhost:8000/runs/run-abc123
curl localhost:8000/runs/run-abc123/logs
```

`POST /runs/workspaces` pre-creates a workspace (returns its `folder`) so a
later `POST /runs/` can pass `folder` to reuse it — e.g. to `destroy` state
left behind by a prior run. Optional per-request `credentials` (AWS access
key/secret/session token) override the server's own AWS env for that one run
and are never echoed back in a response.
