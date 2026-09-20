import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, CLIENT_RETRIES, note, pipe, resolve, retried, sizeOf, startDrop } from "../utilities";
import { capacityFor, ELASTICACHE_ASSUMED, ELASTICACHE_DEFAULTS, resolveCacheSpec, type ElastiCacheConfig } from "./throughput";

export const model: DropModel<ElastiCacheConfig> = {
  defaults: ELASTICACHE_DEFAULTS,

  evaluate(config) {
    const c = resolve(ELASTICACHE_DEFAULTS, config);
    const spec = resolveCacheSpec(c.nodeType);
    return (ctx) => {
      const r = startDrop(ctx, capacityFor(c, sizeOf(ctx, ELASTICACHE_ASSUMED.opBytes)).capacity, ModelTier.Estimated);
      return pipe(
        r,
        cause(DropKind.Timeout, retried(r.rawDrop, CLIENT_RETRIES)),
        note(r.rawDrop.value > 0 && `${(c.nodes * spec.opsPerSec).toLocaleString()} ops/s exceeded: commands queue in socket buffers until clients time out; no retries`),
        note(`maxclients ${spec.maxClients.toLocaleString()} per node not modelled (connections unknown)`),
      );
    };
  },
};
