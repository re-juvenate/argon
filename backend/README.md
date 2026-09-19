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
