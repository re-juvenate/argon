import { useState, type CSSProperties } from "react";
import Node from "../../Node";
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
};

const RETRIEVAL_NAMES: Record<GlacierRetrievalSpeed, string> = {
  [GlacierRetrievalSpeed.EXPEDITED]: "Expedited",
  [GlacierRetrievalSpeed.STANDARD]: "Standard",
  [GlacierRetrievalSpeed.BULK]: "Bulk",
};

const S3 = ({ style }: { style?: CSSProperties }) => {
  const [tier, setTier] = useState(S3StorageTier.STANDARD);
  const [, setConfig] = useState<S3Config>(S3_DEFAULTS);

  const tierOptions: Option[] = Object.values(S3StorageTier).map((t) => ({
    name: TIER_NAMES[t],
    onSelect: () => {
      setTier(t);
      setConfig((c) => ({ ...c, tier: t }));
    },
  }));

  const retrievalOptions: Option[] = Object.values(GlacierRetrievalSpeed).map((r) => ({
    name: RETRIEVAL_NAMES[r],
    onSelect: () => setConfig((c) => ({ ...c, retrieval: r })),
  }));

  return (
    <Node color="#408723" name="S3" style={style}>
      <Dropdown label="Storage Class" options={tierOptions} />
      {ARCHIVE_TIERS.has(tier) && <Dropdown label="Retrieval Speed" options={retrievalOptions} />}
    </Node>
  );
};

export default S3;
