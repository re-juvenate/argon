import pytest
from pydantic import ValidationError

from deploy.schemas import (
    AppRunnerOptions,
    DeploymentCreate,
    DeploymentRead,
    DeploymentStatus,
    Ec2Options,
    Target,
)


def ec2_payload(**overrides):
    data = {"name": "demo", "target": "ec2", "ec2": {}}
    data.update(overrides)
    return data


def test_ec2_defaults():
    req = DeploymentCreate(**ec2_payload())
    assert req.region == "us-east-1"
    assert req.cloudfront is False
    assert req.ec2 == Ec2Options(instance_type="t3.micro", ami=None, user_data=None, port=80)
    assert req.apprunner is None


def test_apprunner_defaults():
    req = DeploymentCreate(name="demo", target="apprunner", apprunner={"image": "public.ecr.aws/x/y:1"})
    assert req.apprunner == AppRunnerOptions(image="public.ecr.aws/x/y:1", port=8080, cpu="1024", memory="2048")
    assert req.target is Target.apprunner


@pytest.mark.parametrize("name", ["", "a" * 41, "Demo", "1abc", "de_mo", "de mo", "-demo"])
def test_invalid_names_rejected(name):
    with pytest.raises(ValidationError):
        DeploymentCreate(**ec2_payload(name=name))


@pytest.mark.parametrize("name", ["a", "a" * 40, "demo-1", "d0"])
def test_valid_names_accepted(name):
    assert DeploymentCreate(**ec2_payload(name=name)).name == name


@pytest.mark.parametrize("port", [0, 65536, -1])
def test_ec2_port_out_of_range(port):
    with pytest.raises(ValidationError):
        Ec2Options(port=port)


@pytest.mark.parametrize("port", [1, 65535])
def test_ec2_port_boundaries(port):
    assert Ec2Options(port=port).port == port


@pytest.mark.parametrize("port", [0, 65536])
def test_apprunner_port_out_of_range(port):
    with pytest.raises(ValidationError):
        AppRunnerOptions(image="img", port=port)


def test_apprunner_requires_image():
    with pytest.raises(ValidationError):
        AppRunnerOptions()


def test_ec2_target_requires_ec2_options():
    with pytest.raises(ValidationError, match="ec2"):
        DeploymentCreate(name="demo", target="ec2")


def test_apprunner_target_requires_apprunner_options():
    with pytest.raises(ValidationError, match="apprunner"):
        DeploymentCreate(name="demo", target="apprunner")


def test_mismatched_options_rejected():
    with pytest.raises(ValidationError, match="apprunner"):
        DeploymentCreate(**ec2_payload(apprunner={"image": "img"}))


def test_unknown_target_rejected():
    with pytest.raises(ValidationError):
        DeploymentCreate(name="demo", target="lambda")


def test_read_defaults():
    read = DeploymentRead(id=1, name="demo", target=Target.ec2, status=DeploymentStatus.pending)
    assert read.outputs == {}
    assert read.error is None


def test_status_values():
    assert {s.value for s in DeploymentStatus} == {
        "pending", "running", "succeeded", "failed", "destroying", "destroyed",
    }
