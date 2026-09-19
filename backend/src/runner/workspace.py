from pathlib import Path
from tempfile import mkdtemp

from runner.schemas import is_safe_filename
from runner.settings import RunnerSettings

PULUMI_YAML = "Pulumi.yaml"


def create_workspace(settings: RunnerSettings) -> Path:
    root = Path(settings.root)
    root.mkdir(parents=True, exist_ok=True)
    return Path(mkdtemp(prefix="run-", dir=root))


def resolve_workspace(folder: str, settings: RunnerSettings) -> Path:
    root = Path(settings.root).resolve()
    candidate = (root / folder).resolve()
    if candidate.parent != root:
        raise ValueError(f"unsafe folder: {folder!r}")
    if not candidate.is_dir():
        raise ValueError(f"workspace not found: {folder!r}")
    return candidate


def write_files(path: Path, files: dict[str, str]) -> list[str]:
    written = []
    for name, content in files.items():
        if not is_safe_filename(name):
            raise ValueError(f"unsafe filename: {name!r}")
        (path / name).write_text(content)
        written.append(name)
    return written


def ensure_project_file(path: Path, project: str) -> None:
    project_file = path / PULUMI_YAML
    if project_file.exists():
        return
    project_file.write_text(f"name: {project}\nruntime: python\n")
