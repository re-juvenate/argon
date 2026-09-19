import pulumi
import pulumi_aws as aws


def origin_config(port: int) -> dict:
    https = port == 443
    return {
        "http_port": 80 if https else port,
        "https_port": port if https else 443,
        "origin_protocol_policy": "https-only" if https else "http-only",
        "origin_ssl_protocols": ["TLSv1.2"],
    }


def create_distribution(name: str, origin_domain: pulumi.Input[str], port: int) -> aws.cloudfront.Distribution:
    origin_id = f"{name}-origin"
    return aws.cloudfront.Distribution(
        f"{name}-cdn",
        enabled=True,
        origins=[{"origin_id": origin_id, "domain_name": origin_domain, "custom_origin_config": origin_config(port)}],
        default_cache_behavior={
            "target_origin_id": origin_id,
            "viewer_protocol_policy": "allow-all",
            "allowed_methods": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
            "cached_methods": ["GET", "HEAD"],
            "forwarded_values": {"query_string": True, "cookies": {"forward": "all"}},
            "min_ttl": 0,
            "default_ttl": 0,
            "max_ttl": 0,
        },
        restrictions={"geo_restriction": {"restriction_type": "none"}},
        viewer_certificate={"cloudfront_default_certificate": True},
    )
