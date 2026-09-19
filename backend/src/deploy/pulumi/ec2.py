import pulumi
import pulumi_aws as aws

from deploy.schemas import Ec2Options

AMAZON_LINUX_OWNER = "amazon"
AMAZON_LINUX_NAME = "al2023-ami-*-x86_64"


def latest_amazon_linux() -> pulumi.Output[str]:
    ami = aws.ec2.get_ami_output(
        most_recent=True,
        owners=[AMAZON_LINUX_OWNER],
        filters=[{"name": "name", "values": [AMAZON_LINUX_NAME]}],
    )
    return ami.id


def create_security_group(name: str, port: int) -> aws.ec2.SecurityGroup:
    return aws.ec2.SecurityGroup(
        f"{name}-sg",
        description=f"Allow inbound {port}",
        ingress=[{"protocol": "tcp", "from_port": port, "to_port": port, "cidr_blocks": ["0.0.0.0/0"]}],
        egress=[{"protocol": "-1", "from_port": 0, "to_port": 0, "cidr_blocks": ["0.0.0.0/0"]}],
    )


def create_instance(name: str, opts: Ec2Options) -> aws.ec2.Instance:
    sg = create_security_group(name, opts.port)
    return aws.ec2.Instance(
        name,
        ami=opts.ami or latest_amazon_linux(),
        instance_type=opts.instance_type,
        user_data=opts.user_data,
        vpc_security_group_ids=[sg.id],
        tags={"Name": name},
    )
