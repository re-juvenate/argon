import json

import pulumi_aws as aws

from deploy.schemas import AppRunnerOptions

ECR_ACCESS_POLICY = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"


def is_private_ecr(image: str) -> bool:
    return ".dkr.ecr." in image


def create_access_role(name: str) -> aws.iam.Role:
    role = aws.iam.Role(
        f"{name}-access-role",
        assume_role_policy=json.dumps(
            {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Principal": {"Service": "build.apprunner.amazonaws.com"},
                        "Action": "sts:AssumeRole",
                    }
                ],
            }
        ),
    )
    aws.iam.RolePolicyAttachment(f"{name}-access-policy", role=role.name, policy_arn=ECR_ACCESS_POLICY)
    return role


def create_service(name: str, opts: AppRunnerOptions) -> aws.apprunner.Service:
    private = is_private_ecr(opts.image)
    source: dict = {
        "auto_deployments_enabled": False,
        "image_repository": {
            "image_identifier": opts.image,
            "image_repository_type": "ECR" if private else "ECR_PUBLIC",
            "image_configuration": {"port": str(opts.port)},
        },
    }
    if private:
        source["authentication_configuration"] = {"access_role_arn": create_access_role(name).arn}
    return aws.apprunner.Service(
        name,
        service_name=name,
        source_configuration=source,
        instance_configuration={"cpu": opts.cpu, "memory": opts.memory},
    )
