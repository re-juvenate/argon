from collections.abc import Callable
from dataclasses import dataclass

import pulumi

from deploy.pulumi import apprunner, cloudfront, ec2
from deploy.schemas import DeploymentCreate, Target


@dataclass
class Origin:
    domain: pulumi.Output[str]
    port: int
    scheme: str

    @property
    def url(self) -> pulumi.Output[str]:
        suffix = "" if self.port in (80, 443) else f":{self.port}"
        return self.domain.apply(lambda d: f"{self.scheme}://{d}{suffix}")


def ec2_origin(req: DeploymentCreate) -> Origin:
    instance = ec2.create_instance(req.name, req.ec2)
    return Origin(instance.public_dns, req.ec2.port, "http")


def apprunner_origin(req: DeploymentCreate) -> Origin:
    service = apprunner.create_service(req.name, req.apprunner)
    return Origin(service.service_url, 443, "https")


ORIGINS: dict[Target, Callable[[DeploymentCreate], Origin]] = {
    Target.ec2: ec2_origin,
    Target.apprunner: apprunner_origin,
}


def build_program(req: DeploymentCreate) -> Callable[[], None]:
    def run() -> None:
        origin = ORIGINS[req.target](req)
        pulumi.export("origin", origin.domain)
        if not req.cloudfront:
            pulumi.export("url", origin.url)
            return
        dist = cloudfront.create_distribution(req.name, origin.domain, origin.port)
        pulumi.export("cloudfront_domain", dist.domain_name)
        pulumi.export("url", dist.domain_name.apply(lambda d: f"https://{d}"))

    return run
