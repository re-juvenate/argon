from enum import Enum

from pydantic import BaseModel, Field, field_validator, model_validator

MAX_FILES = 50
MAX_FILE_BYTES = 1024 * 1024
MAX_TOTAL_BYTES = 10 * 1024 * 1024
MAX_NAME_LENGTH = 255
ENTRYPOINT = "__main__.py"

NAME_PATTERN = r"^[a-zA-Z][\w.-]*$"
FOLDER_PATTERN = r"^[\w.-]+$"


class RunStatus(str, Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    timed_out = "timed_out"


class AwsCredentials(BaseModel):
    access_key_id: str
    secret_access_key: str
    session_token: str | None = None


def is_safe_filename(name: str) -> bool:
    if not name or len(name) > MAX_NAME_LENGTH:
        return False
    if "/" in name or "\\" in name:
        return False
    if name in (".", "..") or name.startswith("~"):
        return False
    return True


class RunCreate(BaseModel):
    files: dict[str, str]
    folder: str | None = Field(None, pattern=FOLDER_PATTERN, max_length=MAX_NAME_LENGTH)
    project: str = Field("argon-run", pattern=NAME_PATTERN, max_length=100)
    stack: str = Field("dev", pattern=r"^[a-zA-Z0-9][\w.-]*$", max_length=100)
    region: str = "us-east-1"
    credentials: AwsCredentials | None = None

    @field_validator("files")
    @classmethod
    def validate_files(cls, files: dict[str, str]) -> dict[str, str]:
        if not files:
            raise ValueError("files must not be empty")
        if ENTRYPOINT not in files:
            raise ValueError(f"files must contain {ENTRYPOINT}")
        if len(files) > MAX_FILES:
            raise ValueError(f"at most {MAX_FILES} files are allowed")
        total = 0
        for name, content in files.items():
            if not is_safe_filename(name):
                raise ValueError(f"unsafe filename: {name!r}")
            size = len(content.encode())
            if size > MAX_FILE_BYTES:
                raise ValueError(f"file {name!r} exceeds {MAX_FILE_BYTES} bytes")
            total += size
        if total > MAX_TOTAL_BYTES:
            raise ValueError(f"total file size exceeds {MAX_TOTAL_BYTES} bytes")
        return files


class RunRead(BaseModel):
    folder: str
    path: str
    status: RunStatus
    exit_code: int | None = None
    error: str | None = None


class WorkspaceRead(BaseModel):
    folder: str
    path: str
