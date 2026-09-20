# EC2 Docker deployment

The backend runs separately from the Amplify frontend. CloudFront provides its
public HTTPS endpoint with no login required. Requests go through a CloudFront
VPC origin to Nginx on EC2 port 8080, then to Docker on `127.0.0.1:8000`.
The EC2 security group allows port 8080 only from CloudFront's service security
group. Administrative access uses AWS Systems Manager.

| Setting | Value |
| --- | --- |
| AWS CLI profile | `personal` |
| Region | `ap-south-1` |
| Instance | `i-00313d3e0619a5fb6` (`argon-backend`) |
| Instance type | `t3.small`, standard CPU credits |
| Operating system | Amazon Linux 2023 |
| Disk | 20 GiB encrypted gp3 |
| Container | `argon-backend` |
| Image | `916218008693.dkr.ecr.ap-south-1.amazonaws.com/argon-backend:20260920` |
| Restart policy | `unless-stopped` |
| Host data directory | `/var/lib/argon`, mounted at `/data` |
| Host environment file | `/etc/argon/backend.env`, readable only by root |
| Security group | `sg-026f79a30d8790662` |
| Instance role | `argon-backend-ec2` |
| Public HTTPS URL | `https://d2o80ycdx5x95t.cloudfront.net` |
| CloudFront distribution | `E29VLJBE7WZJMG` |
| CloudFront VPC origin | `vo_1K1iZVqr4aZCQ94xjo3VL9` |
| CloudFront service security group | `sg-0f1c5adedc6df7b53` |
| Nginx configuration | `/etc/nginx/conf.d/argon-api.conf` |

Deployed image digest:
`sha256:1ac2d32f1ef72e7fa1e78a3f4dd7f91a5329c119a4411938cd0867255f535ce5`.

The instance role allows Systems Manager management and pulling this ECR
repository. It does not grant the application permission to create AWS resources.
IMDSv2 is required, with a response hop limit of one.

## Public HTTPS access

API docs: <https://d2o80ycdx5x95t.cloudfront.net/docs>.

```sh
curl --fail https://d2o80ycdx5x95t.cloudfront.net/openapi.json
```

CloudFront redirects HTTP requests to HTTPS and serves `/docs` at the root URL.
All API methods, query parameters, cookies, and viewer headers are forwarded.
API response caching is disabled. The public endpoint does not require
authentication, including for deployment and code execution routes.

The Nginx configuration is tracked in [deploy/nginx.conf](deploy/nginx.conf).
After updating its installed copy on EC2, validate and reload it:

```sh
sudo nginx -t && sudo systemctl reload nginx
```

## Connect

Use **EC2 → argon-backend → Connect → Session Manager** in the AWS console,
or the following command with the AWS CLI Session Manager plugin installed:

```sh
aws ssm start-session --target i-00313d3e0619a5fb6 \
  --profile personal --region ap-south-1
```

On the instance:

```sh
sudo docker ps --filter name=argon-backend
sudo docker logs --tail 100 argon-backend
curl --fail http://127.0.0.1:8000/openapi.json
```

To open the API docs on your own machine, keep this tunnel running and visit
`http://localhost:8000/docs`:

```sh
aws ssm start-session --target i-00313d3e0619a5fb6 \
  --document-name AWS-StartPortForwardingSession \
  --parameters '{"portNumber":["8000"],"localPortNumber":["8000"]}' \
  --profile personal --region ap-south-1
```

## Storage and restarts

Docker and Nginx start at boot. The container has a health check, a 1500 MiB memory
limit, and log rotation (three files of up to 10 MB).

Pulumi state, plugins, and runner files persist under `/var/lib/argon`. Preserve
the passphrase in `/etc/argon/backend.env` when migrating that state. Agent,
deployment, and job status records currently live in application memory and
reset when the process restarts. The root EBS volume is deleted on instance
termination; this setup does not configure backups.

The ECR tag is immutable. Use a new image tag for the next deployment.
