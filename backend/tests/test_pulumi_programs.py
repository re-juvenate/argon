import pulumi
import pytest

from deploy.pulumi import apprunner, cloudfront, ec2, program
from deploy.schemas import AppRunnerOptions, DeploymentCreate, Ec2Options


class RecordingMocks(pulumi.runtime.Mocks):
    def __init__(self):
        self.resources = []
        self.calls = []

    def new_resource(self, args: pulumi.runtime.MockResourceArgs):
        self.resources.append(args)
        outputs = dict(args.inputs)
        outputs.update(
            {
                "publicDns": f"{args.name}.compute.amazonaws.com",
                "publicIp": "1.2.3.4",
                "serviceUrl": f"{args.name}.awsapprunner.com",
                "domainName": f"{args.name}.cloudfront.net",
                "arn": f"arn:{args.name}",
            }
        )
        return [f"{args.name}-id", outputs]

    def call(self, args: pulumi.runtime.MockCallArgs):
        self.calls.append(args)
        if args.token == "aws:ec2/getAmi:getAmi":
            return {"id": "ami-mock"}
        return {}


mocks = RecordingMocks()
pulumi.runtime.set_mocks(mocks, project="test", stack="test", preview=False)


@pytest.fixture(autouse=True)
def reset_mocks():
    mocks.resources.clear()
    mocks.calls.clear()
    yield


def by_type(token):
    return [r for r in mocks.resources if r.typ == token]


@pulumi.runtime.test
def test_ec2_creates_security_group_and_instance():
    instance = ec2.create_instance("demo", Ec2Options(port=8000))

    def check(_):
        sgs = by_type("aws:ec2/securityGroup:SecurityGroup")
        assert len(sgs) == 1
        ingress = sgs[0].inputs["ingress"][0]
        assert (ingress["fromPort"], ingress["toPort"]) == (8000, 8000)
        assert ingress["cidrBlocks"] == ["0.0.0.0/0"]
        inst = by_type("aws:ec2/instance:Instance")[0]
        assert inst.inputs["instanceType"] == "t3.micro"
        assert inst.inputs["ami"] == "ami-mock"
        assert any(c.token == "aws:ec2/getAmi:getAmi" for c in mocks.calls)

    return instance.id.apply(check)


@pulumi.runtime.test
def test_ec2_uses_given_ami_and_user_data():
    instance = ec2.create_instance("demo", Ec2Options(ami="ami-123", user_data="#!/bin/sh"))

    def check(_):
        inst = by_type("aws:ec2/instance:Instance")[0]
        assert inst.inputs["ami"] == "ami-123"
        assert inst.inputs["userData"] == "#!/bin/sh"
        assert not any(c.token == "aws:ec2/getAmi:getAmi" for c in mocks.calls)

    return instance.id.apply(check)


@pulumi.runtime.test
def test_apprunner_public_image_needs_no_role():
    service = apprunner.create_service("demo", AppRunnerOptions(image="public.ecr.aws/x/y:1", port=3000))

    def check(_):
        assert by_type("aws:iam/role:Role") == []
        svc = by_type("aws:apprunner/service:Service")[0]
        source = svc.inputs["sourceConfiguration"]
        repo = source["imageRepository"]
        assert repo["imageIdentifier"] == "public.ecr.aws/x/y:1"
        assert repo["imageRepositoryType"] == "ECR_PUBLIC"
        assert repo["imageConfiguration"]["port"] == "3000"
        assert "authenticationConfiguration" not in source
        assert svc.inputs["instanceConfiguration"] == {"cpu": "1024", "memory": "2048"}

    return service.id.apply(check)


@pulumi.runtime.test
def test_apprunner_private_ecr_creates_access_role():
    image = "123456789012.dkr.ecr.us-east-1.amazonaws.com/app:1"
    service = apprunner.create_service("demo", AppRunnerOptions(image=image))

    def check(_):
        roles = by_type("aws:iam/role:Role")
        assert len(roles) == 1
        assert by_type("aws:iam/rolePolicyAttachment:RolePolicyAttachment")
        svc = by_type("aws:apprunner/service:Service")[0]
        source = svc.inputs["sourceConfiguration"]
        assert source["imageRepository"]["imageRepositoryType"] == "ECR"
        assert source["authenticationConfiguration"]["accessRoleArn"] == "arn:demo-access-role"

    return service.id.apply(check)


@pulumi.runtime.test
def test_cloudfront_points_at_origin():
    dist = cloudfront.create_distribution("demo", pulumi.Output.from_input("origin.example.com"), 8080)

    def check(_):
        d = by_type("aws:cloudfront/distribution:Distribution")[0]
        origin = d.inputs["origins"][0]
        assert origin["domainName"] == "origin.example.com"
        assert origin["customOriginConfig"]["httpPort"] == 8080
        assert origin["customOriginConfig"]["originProtocolPolicy"] == "http-only"
        assert d.inputs["defaultCacheBehavior"]["viewerProtocolPolicy"] == "allow-all"
        assert d.inputs["viewerCertificate"]["cloudfrontDefaultCertificate"] is True
        assert d.inputs["enabled"] is True

    return dist.id.apply(check)


@pulumi.runtime.test
def test_cloudfront_https_origin_for_443():
    dist = cloudfront.create_distribution("demo", pulumi.Output.from_input("o"), 443)

    def check(_):
        cfg = by_type("aws:cloudfront/distribution:Distribution")[0].inputs["origins"][0]["customOriginConfig"]
        assert cfg["originProtocolPolicy"] == "https-only"
        assert cfg["httpsPort"] == 443

    return dist.id.apply(check)


def run_program(req):
    exported = {}
    original = pulumi.export

    def capture(name, value):
        exported[name] = value
        original(name, value)

    pulumi.export = capture
    try:
        program.build_program(req)()
    finally:
        pulumi.export = original
    return exported


@pulumi.runtime.test
def test_program_ec2_without_cloudfront():
    exported = run_program(DeploymentCreate(name="demo", target="ec2", ec2={"port": 8000}))

    def check(values):
        assert set(exported) == {"url", "origin"}
        assert values[0] == "http://demo.compute.amazonaws.com:8000"
        assert values[1] == "demo.compute.amazonaws.com"
        assert by_type("aws:cloudfront/distribution:Distribution") == []

    return pulumi.Output.all(exported["url"], exported["origin"]).apply(check)


@pulumi.runtime.test
def test_program_ec2_with_cloudfront():
    exported = run_program(DeploymentCreate(name="demo", target="ec2", ec2={}, cloudfront=True))

    def check(values):
        assert set(exported) == {"url", "origin", "cloudfront_domain"}
        assert values[0] == "https://demo-cdn.cloudfront.net"
        assert values[1] == "demo-cdn.cloudfront.net"
        origin = by_type("aws:cloudfront/distribution:Distribution")[0].inputs["origins"][0]
        assert origin["domainName"] == "demo.compute.amazonaws.com"
        assert origin["customOriginConfig"]["httpPort"] == 80

    return pulumi.Output.all(exported["url"], exported["cloudfront_domain"]).apply(check)


@pulumi.runtime.test
def test_program_apprunner_with_cloudfront():
    exported = run_program(
        DeploymentCreate(name="demo", target="apprunner", apprunner={"image": "public.ecr.aws/x:1"}, cloudfront=True)
    )

    def check(values):
        assert values[0] == "https://demo-cdn.cloudfront.net"
        assert values[1] == "demo.awsapprunner.com"
        cfg = by_type("aws:cloudfront/distribution:Distribution")[0].inputs["origins"][0]["customOriginConfig"]
        assert cfg["originProtocolPolicy"] == "https-only"

    return pulumi.Output.all(exported["url"], exported["origin"]).apply(check)


@pulumi.runtime.test
def test_program_apprunner_without_cloudfront():
    exported = run_program(DeploymentCreate(name="demo", target="apprunner", apprunner={"image": "img"}))

    def check(values):
        assert values[0] == "https://demo.awsapprunner.com"
        assert set(exported) == {"url", "origin"}

    return pulumi.Output.all(exported["url"], exported["origin"]).apply(check)
