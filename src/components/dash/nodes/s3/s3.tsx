import type { CSSProperties } from "react";
import Node from "../../Node";
import { useNodeConfig } from "#graph";
import { ServiceType } from "../../../../types/math";
import Dropdown from "../../nodeoptions/dropdown";
import type { Option } from "../../nodeoptions/dropdown";
import { ARCHIVE_TIERS, S3_DEFAULTS, type S3Config } from "#math/s3/throughput";
import { GlacierRetrievalSpeed, S3StorageTier } from "#math/s3/cost";

// Controls map onto the S3Config inputs of math/s3/throughput:
// tier (dropdown) and retrieval (dropdown, archive tiers only).
const TIER_NAMES: Record<S3StorageTier, string> = {
  [S3StorageTier.STANDARD]: "Standard",
  [S3StorageTier.INFREQUENT_ACCESS]: "Standard-IA",
  [S3StorageTier.ONE_ZONE_IA]: "One Zone-IA",
  [S3StorageTier.GLACIER_INSTANT]: "Glacier Instant",
  [S3StorageTier.GLACIER_FLEXIBLE]: "Glacier Flexible",
  [S3StorageTier.DEEP_ARCHIVE]: "Deep Archive",
  [S3StorageTier.INTELLIGENT_TIERING]: "Intelligent-Tiering",
  [S3StorageTier.EXPRESS_ONE_ZONE]: "Express One Zone",
};

const RETRIEVAL_NAMES: Record<GlacierRetrievalSpeed, string> = {
  [GlacierRetrievalSpeed.EXPEDITED]: "Expedited",
  [GlacierRetrievalSpeed.STANDARD]: "Standard",
  [GlacierRetrievalSpeed.BULK]: "Bulk",
};

const S3 = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<S3Config>(ServiceType.S3, S3_DEFAULTS, id);

  const tierOptions: Option[] = Object.values(S3StorageTier).map((t) => ({
    name: TIER_NAMES[t],
    onSelect: () => patch({ tier: t }),
  }));

  const retrievalOptions: Option[] = Object.values(GlacierRetrievalSpeed).map((r) => ({
    name: RETRIEVAL_NAMES[r],
    onSelect: () => patch({ retrieval: r }),
  }));

  return (
    <Node id={nodeId} color="#408723" name="S3" style={style}>
      <Dropdown label="Storage Class" options={tierOptions} />
      {ARCHIVE_TIERS.has(config.tier ?? S3_DEFAULTS.tier) && <Dropdown label="Retrieval Speed" options={retrievalOptions} />}
    </Node>
  );
};

export default S3;
