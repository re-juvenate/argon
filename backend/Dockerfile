FROM ghcr.io/astral-sh/uv:python3.12-trixie-slim

ARG PULUMI_VERSION=3.263.0

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PATH="/root/.pulumi/bin:/app/.venv/bin:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && mkdir -p /root/.pulumi/bin \
    && curl -fSL --retry 3 --connect-timeout 15 --max-time 300 \
       "https://get.pulumi.com/releases/sdk/pulumi-v${PULUMI_VERSION}-linux-x64.tar.gz" \
       -o /tmp/pulumi.tar.gz \
    && tar -xzf /tmp/pulumi.tar.gz -C /root/.pulumi/bin --strip-components=1 \
    && rm /tmp/pulumi.tar.gz \
    && apt-get purge -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev

COPY src ./src

EXPOSE 8000

CMD ["uvicorn", "main:app", "--app-dir", "src", "--host", "0.0.0.0", "--port", "8000"]
