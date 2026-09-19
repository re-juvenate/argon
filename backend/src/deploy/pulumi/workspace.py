import logging
from collections.abc import Callable

import pulumi.automation as auto

from deploy.schemas import DeploymentCreate
from deploy.settings import Settings

logger = logging.getLogger(__name__)


def log_output(line: str) -> None:
    logger.info(line)


def stack_name(req: DeploymentCreate) -> str:
    return f"{req.target.value}-{req.name}"


def workspace_options(settings: Settings) -> auto.LocalWorkspaceOptions:
    return auto.LocalWorkspaceOptions(
        pulumi_home=settings.pulumi_home,
        env_vars={"PULUMI_CONFIG_PASSPHRASE": settings.pulumi_config_passphrase},
        project_settings=auto.ProjectSettings(
            name=settings.pulumi_project,
            runtime="python",
            backend=auto.ProjectBackend(url=settings.pulumi_backend_url),
        ),
    )


def select_stack(req: DeploymentCreate, program: Callable[[], None], settings: Settings) -> auto.Stack:
    stack = auto.create_or_select_stack(
        stack_name=stack_name(req),
        project_name=settings.pulumi_project,
        program=program,
        opts=workspace_options(settings),
    )
    stack.set_config("aws:region", auto.ConfigValue(value=req.region))
    return stack


def up(stack: auto.Stack) -> dict[str, str]:
    result = stack.up(on_output=log_output)
    return {key: str(out.value) for key, out in result.outputs.items()}


def destroy(stack: auto.Stack) -> None:
    stack.destroy(on_output=log_output)
    stack.workspace.remove_stack(stack.name)
