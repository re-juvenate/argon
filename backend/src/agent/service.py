import json
from collections.abc import Callable

from agent.groq import FALLBACK_MODELS, with_groq_retry
from agent.prompts import SUGGESTABLE, SYSTEM_PROMPT, user_message
from agent.schemas import Additions, CompletionRead, Graph, GraphEdge, GraphNode, NodeUpdate, Plan, PlannedNode, ServiceType
from agent.settings import AgentSettings

Planner = Callable[[str, str], Plan]

FRAMES = {ServiceType.asg, ServiceType.region, ServiceType.vpc}
ASG_MEMBERS = {ServiceType.ec2, ServiceType.ecs}
ADDABLE = set(SUGGESTABLE)


def build_planner(settings: AgentSettings) -> Planner:
    from strands import Agent
    from strands.event_loop._retry import ModelRetryStrategy
    from strands.models.openai import OpenAIModel
    from strands.session.file_session_manager import FileSessionManager
    from strands.types.exceptions import ModelThrottledException

    models = [settings.model_id, *[m for m in FALLBACK_MODELS if m != settings.model_id]]

    def call(session_id: str, prompt: str) -> Callable[[str], Plan]:
        def run(model_id: str) -> Plan:
            agent = Agent(
                model=OpenAIModel(
                    client_args={"api_key": settings.groq_api_key, "base_url": settings.groq_base_url},
                    model_id=model_id,
                    params={"max_tokens": settings.max_tokens, "temperature": 0.2},
                ),
                system_prompt=SYSTEM_PROMPT,
                session_manager=FileSessionManager(session_id=session_id, storage_dir=settings.session_dir),
                agent_id="completion",
                callback_handler=None,
                retry_strategy=ModelRetryStrategy(max_attempts=1),
            )
            result = agent(prompt, structured_output_model=Plan)
            if not isinstance(result.structured_output, Plan):
                raise RuntimeError("model returned no plan")
            return result.structured_output

        return run

    def plan(session_id: str, prompt: str) -> Plan:
        return with_groq_retry(call(session_id, prompt), models, lambda e: isinstance(e, ModelThrottledException))

    return plan


def parse_config(raw: str | None) -> dict:
    try:
        value = json.loads(raw or "{}")
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


class CompletionService:
    def __init__(self, planner: Planner) -> None:
        self.planner = planner
        self.proposed: dict[str, list[str]] = {}

    def complete(self, session_id: str, graph: Graph, prompt: str | None) -> CompletionRead:
        present = {n.id for n in graph.nodes} | {e.id for e in graph.edges}
        last = self.proposed.get(session_id, [])
        accepted = [i for i in last if i in present]
        rejected = [i for i in last if i not in present]
        message = user_message(prompt, graph.model_dump_json(by_alias=True, exclude_none=True), accepted, rejected)
        plan = self.planner(session_id, message)
        added = self.materialize(graph, plan)
        self.proposed[session_id] = [n.id for n in added.nodes] + [e.id for e in added.edges]
        removed = set(added.removedEdges)
        updates = {u.id: u for u in added.updates}
        nodes = [CompletionService.apply_update(n, updates.get(n.id)) for n in graph.nodes] + added.nodes
        merged = Graph(
            version=1,
            defaults=graph.defaults,
            nodes=nodes,
            edges=[e for e in graph.edges if e.id not in removed] + added.edges,
        )
        return CompletionRead(session_id=session_id, rationale=plan.rationale, graph=merged, added=added)

    @staticmethod
    def apply_update(node: GraphNode, u: NodeUpdate | None) -> GraphNode:
        if u is None:
            return node
        return node.model_copy(
            update={
                "name": u.name if u.name is not None else node.name,
                "config": {**node.config, **(u.config or {})},
                "position": u.position or node.position,
            }
        )

    @staticmethod
    def materialize(graph: Graph, plan: Plan) -> Additions:
        existing = {n.id: n for n in graph.nodes}
        nodes: list[GraphNode] = []
        for p in plan.nodes:
            if p.id in existing or any(n.id == p.id for n in nodes) or p.service not in ADDABLE:
                continue
            nodes.append(CompletionService.to_node(p))
        known = {**existing, **{n.id: n for n in nodes}}
        for n in nodes:
            parent = known.get(n.parentId) if n.parentId else None
            if parent is None or parent.service != ServiceType.asg or parent.id == n.id or n.service not in ASG_MEMBERS:
                n.parentId = None

        existing_edges = {e.id: e for e in graph.edges}
        removed = [i for i in dict.fromkeys(plan.removeEdges) if i in existing_edges]
        removed_set = set(removed)

        edge_ids = set(existing_edges)
        seen = {(e.from_, e.to) for e in graph.edges if e.id not in removed_set}
        edges: list[GraphEdge] = []
        for e in plan.edges:
            if e.source == e.target or (e.source, e.target) in seen:
                continue
            a, b = known.get(e.source), known.get(e.target)
            if a is None or b is None or a.service in FRAMES or b.service in FRAMES:
                continue
            if CompletionService.in_asg(a, known) or CompletionService.in_asg(b, known):
                continue
            edge_id = e.id if e.id not in edge_ids else f"ai-edge-{e.source}-{e.target}"
            edge_ids.add(edge_id)
            seen.add((e.source, e.target))
            edges.append(GraphEdge(id=edge_id, **{"from": e.source}, to=e.target))

        updates: list[NodeUpdate] = []
        for u in plan.updates:
            node = existing.get(u.id)
            if node is None or node.service in FRAMES or u.id in {x.id for x in updates}:
                continue
            config = parse_config(u.config) if u.config else None
            position = None
            if u.x is not None and u.y is not None:
                position = {"x": u.x, "y": u.y}
            if u.name is None and not config and position is None:
                continue
            updates.append(NodeUpdate(id=u.id, name=u.name, config=config or None, position=position))

        return Additions(nodes=nodes, edges=edges, removedEdges=removed, updates=updates)

    @staticmethod
    def to_node(p: PlannedNode) -> GraphNode:
        return GraphNode(
            id=p.id,
            service=p.service,
            name=p.name,
            config=parse_config(p.config),
            position={"x": p.x, "y": p.y},
            parentId=p.parentId,
        )

    @staticmethod
    def in_asg(node: GraphNode, known: dict[str, GraphNode]) -> bool:
        parent = known.get(node.parentId) if node.parentId else None
        return parent is not None and parent.service == ServiceType.asg
