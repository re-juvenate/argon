import pytest

from runner import workspace
from runner.settings import RunnerSettings


@pytest.fixture
def settings(tmp_path):
    return RunnerSettings(root=str(tmp_path / "runs"))


def test_create_workspace_creates_root_and_unique_dirs(settings):
    p1 = workspace.create_workspace(settings)
    p2 = workspace.create_workspace(settings)
    assert p1.is_dir()
    assert p2.is_dir()
    assert p1 != p2
    assert p1.parent == p2.parent


def test_create_workspace_folder_name_has_prefix(settings):
    p = workspace.create_workspace(settings)
    assert p.name.startswith("run-")


def test_write_files_writes_verbatim(settings):
    p = workspace.create_workspace(settings)
    written = workspace.write_files(p, {"__main__.py": "print(1)", "helper.py": "x = 1"})
    assert set(written) == {"__main__.py", "helper.py"}
    assert (p / "__main__.py").read_text() == "print(1)"
    assert (p / "helper.py").read_text() == "x = 1"


def test_write_files_overwrites_existing(settings):
    p = workspace.create_workspace(settings)
    workspace.write_files(p, {"a.py": "old"})
    workspace.write_files(p, {"a.py": "new"})
    assert (p / "a.py").read_text() == "new"


@pytest.mark.parametrize("name", ["../escape.py", "/etc/passwd", "a/b.py"])
def test_write_files_rejects_traversal(settings, name):
    p = workspace.create_workspace(settings)
    with pytest.raises(ValueError):
        workspace.write_files(p, {name: "x"})
    assert list(p.iterdir()) == []


def test_ensure_project_file_writes_when_absent(settings):
    p = workspace.create_workspace(settings)
    workspace.ensure_project_file(p, "myproj")
    content = (p / "Pulumi.yaml").read_text()
    assert "myproj" in content
    assert "python" in content


def test_ensure_project_file_preserves_existing(settings):
    p = workspace.create_workspace(settings)
    (p / "Pulumi.yaml").write_text("name: already-here\nruntime: python\n")
    workspace.ensure_project_file(p, "myproj")
    assert (p / "Pulumi.yaml").read_text() == "name: already-here\nruntime: python\n"


def test_resolve_workspace_returns_existing_path(settings):
    p = workspace.create_workspace(settings)
    resolved = workspace.resolve_workspace(p.name, settings)
    assert resolved == p


def test_resolve_workspace_missing_raises(settings):
    workspace.create_workspace(settings)
    with pytest.raises(ValueError):
        workspace.resolve_workspace("does-not-exist", settings)


@pytest.mark.parametrize("folder", ["../etc", "/etc", "..", "a/b"])
def test_resolve_workspace_rejects_escape(settings, folder):
    with pytest.raises(ValueError):
        workspace.resolve_workspace(folder, settings)
