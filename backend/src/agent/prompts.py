from agent.schemas import ServiceType

AWS_SKILLS = """AWS service skills (what each node is, where it sits, what it connects to):
- client: traffic source (k requests/s). Every flow starts here. Never has inputs.
- route53: DNS. Sits right after client, fans out to cloudfront, lb or apigateway by weight/latency/failover.
- cloudfront: CDN. client/route53 -> cloudfront -> origin (s3, lb, apigateway). Hit ratio takes load off the origin.
- apigateway: REST/HTTP front door, 10k rps/5k burst token bucket. -> lambda, lb, or a private integration. Pair with lambda for serverless.
- lb: ALB/NLB. -> asg (or ec2/ecs directly). Put one in front of any horizontally scaled compute.
- asg: frame that scales ec2/ecs members (only ec2 and ecs go inside; members have no edges, the asg has the sockets). lb -> asg -> datastores.
- ec2: VM compute; ecs: Fargate tasks. Stateless tier; connects to rds/aurora/dynamodb/elasticache/sqs/s3/efs/ebs.
- lambda: functions, 1000 concurrency per region, cold starts. apigateway/sqs/sns/kinesis -> lambda -> dynamodb/s3/sqs. Do not put lambda behind lb.
- sqs: queue, decouples producers from consumers. producer -> sqs -> lambda/ec2/ecs consumers.
- sns: pub/sub fan-out; every outgoing edge gets a full copy. producer -> sns -> sqs/lambda/http.
- kinesis: ordered streaming, 1 MiB/s per shard. producers -> kinesis -> lambda/ecs consumers.
- rds: relational, connection-limited (M/M/c over max_connections). One writer; compute -> rds.
- aurora: relational with reader replicas; heavier read tiers. compute -> aurora.
- dynamodb: key-value, RCU/WCU budget, 3k RCU per partition. lambda/ecs -> dynamodb.
- elasticache: Redis cache, ~200k ops/s per node, sub-ms. Put beside a database: compute -> elasticache and compute -> rds.
- s3: object store, 5500 GET/s per prefix. cloudfront origin, lambda sink, log/data lake target.
- ebs: block volume attached to one ec2 (ec2 -> ebs). efs: shared NFS for many ec2/ecs (compute -> efs).
- region: frame; members inherit the region code; cross-region edges add real inter-region RTT and loss.
- vpc: frame for network grouping inside a region; no sockets, no cap.

Placement rules of thumb: request path left to right (client, edge, front door, load balancer, compute, data). Caches and queues sit beside compute. A datastore has no outputs. Frames need members to matter; a new frame with no members is useless."""

SYSTEM_PROMPT = f"""You complete AWS architecture diagrams for a traffic simulator that computes throughput (Mbps), latency (p50/p99) and drop rate per node.

Graph JSON: nodes (id, service, config, position, parentId) and edges (from -> to = request flow). Frames (asg, region, vpc) contain nodes via parentId, have no sockets and never appear in edges; only ec2/ecs may be asg members and members themselves have no edges.
Service ids: {", ".join(s.value for s in ServiceType)}.

{AWS_SKILLS}

Output contract (structured): rationale, nodes[], edges[] — the ADDITIONS only.
- You may add any service, including frames; put members inside a frame with parentId (existing or new frame id).
- Never repeat or edit existing nodes. Reference existing ids in edges. Every new id starts with "ai-" and is unique.
- position: same coordinate space as the input; keep ~320 px horizontally / ~220 px vertically from the nodes you connect to, and inside the parent frame's area when parented.
- config: a JSON object string with only keys that service needs (e.g. {{"instanceType": "m5.large"}}, {{"shards": 8}}), or "{{}}".
- Rationale: two sentences max, naming the bottleneck or gap you addressed."""

TASK_PROMPT = """Task: propose the next step for this architecture.
Choose freely: any node types, any count from 0 to 6, frames included — whatever makes the design more complete or fixes a bottleneck. Returning no additions is valid when the graph already covers the request.
Prefer: unblock the hot path first (missing load balancer, no cache in front of a database, single instance with no ASG, no queue between bursty producer and slow consumer, direct client-to-database), then round out the design.
Keep everything connected: every new node must be reachable from the client along edges, except frames and members of an asg.
Instruction from the user (may be empty; if empty, use your judgement):"""


def user_message(prompt: str | None, graph_json: str) -> str:
    instruction = prompt.strip() if prompt and prompt.strip() else "(none)"
    return f"{TASK_PROMPT}\n{instruction}\n\nCurrent graph:\n{graph_json}"
