import pytest
from pydantic import ValidationError

from runner.schemas import AwsCredentials, RunCreate, RunRead, RunStatus, WorkspaceRead


def files(**overrides):
    data = {"__main__.py": "print('hi')"}
    data.update(overrides)
    return data


def test_defaults():
    req = RunCreate(files=files())
    assert req.folder is None
    assert req.project == "argon-run"
    assert req.stack == "dev"
    assert req.region == "us-east-1"
    assert req.credentials is None


def test_requires_main_file():
    with pytest.raises(ValidationError, match="__main__.py"):
        RunCreate(files={"other.py": "x"})


def test_rejects_empty_files():
    with pytest.raises(ValidationError):
        RunCreate(files={})


def test_rejects_too_many_files():
    data = {f"f{i}.py": "x" for i in range(50)}
    data["__main__.py"] = "print(1)"
    with pytest.raises(ValidationError, match="50"):
        RunCreate(files=data)


def test_accepts_max_files():
    data = {f"f{i}.py": "x" for i in range(49)}
    data["__main__.py"] = "print(1)"
    assert len(RunCreate(files=data).files) == 50


@pytest.mark.parametrize(
    "name", ["a" * 256 + ".py", "../x.py", "/etc/passwd", "a/b.py", "a\\b.py", "~/x.py", "", ".", "..", "~"]
)
def test_rejects_unsafe_filenames(name):
    with pytest.raises(ValidationError):
        RunCreate(files=files(**{name: "x"}))


def test_rejects_oversized_file_body():
    with pytest.raises(ValidationError, match="1"):
        RunCreate(files=files(**{"big.py": "x" * (1024 * 1024 + 1)}))


def test_accepts_file_body_at_limit():
    req = RunCreate(files=files(**{"big.py": "x" * (1024 * 1024)}))
    assert len(req.files["big.py"]) == 1024 * 1024


def test_rejects_oversized_total():
    data = {f"f{i}.py": "x" * (1024 * 1024) for i in range(10)}
    data["__main__.py"] = "x" * (1024 * 1024)
    with pytest.raises(ValidationError, match="10"):
        RunCreate(files=data)


@pytest.mark.parametrize("stack", ["", "-bad", "has space", "a" * 101])
def test_rejects_invalid_stack(stack):
    with pytest.raises(ValidationError):
        RunCreate(files=files(), stack=stack)


@pytest.mark.parametrize("project", ["", "1bad", "has space", "a" * 101])
def test_rejects_invalid_project(project):
    with pytest.raises(ValidationError):
        RunCreate(files=files(), project=project)


def test_credentials_require_all_fields():
    with pytest.raises(ValidationError):
        AwsCredentials(access_key_id="x")


def test_credentials_session_token_optional():
    creds = AwsCredentials(access_key_id="a", secret_access_key="b")
    assert creds.session_token is None


def test_run_create_accepts_credentials():
    req = RunCreate(files=files(), credentials={"access_key_id": "a", "secret_access_key": "b"})
    assert req.credentials.access_key_id == "a"


def test_run_read_never_carries_credentials():
    read = RunRead(folder="f1", path="/tmp/f1", status=RunStatus.queued)
    assert "credentials" not in RunRead.model_fields
    assert read.exit_code is None
    assert read.error is None


def test_workspace_read_shape():
    ws = WorkspaceRead(folder="f1", path="/tmp/f1")
    assert ws.folder == "f1"
    assert ws.path == "/tmp/f1"


def test_status_values():
    assert {s.value for s in RunStatus} == {"queued", "running", "succeeded", "failed", "timed_out"}


def test_folder_pattern_reused_for_reuse_field():
    req = RunCreate(files=files(), folder="run-abc123")
    assert req.folder == "run-abc123"


@pytest.mark.parametrize("folder", ["../etc", "a/b", "", "a" * 256])
def test_rejects_unsafe_reuse_folder(folder):
    with pytest.raises(ValidationError):
        RunCreate(files=files(), folder=folder)
