export enum S3StorageTier {
  STANDARD = "STANDARD",
  INFREQUENT_ACCESS = "INFREQUENT_ACCESS",
  ONE_ZONE_IA = "ONE_ZONE_IA",
  GLACIER_INSTANT = "GLACIER_INSTANT",
  GLACIER_FLEXIBLE = "GLACIER_FLEXIBLE",
  DEEP_ARCHIVE = "DEEP_ARCHIVE",
}

export enum GlacierRetrievalSpeed {
  EXPEDITED = "EXPEDITED",
  STANDARD = "STANDARD",
  BULK = "BULK",
}

export interface RequestVolume {
  writeOperations: number;
  readOperations: number;
}

export interface NetworkEgressVolume {
  toInternetGb: number;
  toOtherRegionsGb: number;
}

export interface ManagedObjectCounts {
  intelligentTieringCount?: number;
  storageLensCount?: number;
  inventoryCount?: number;
}

interface ApiRates {
  readonly writePer1000: number;
  readonly readPer1000: number;
}

const TIER_API_RATES: Record<S3StorageTier, ApiRates> = {
  [S3StorageTier.STANDARD]: { writePer1000: 0.005, readPer1000: 0.0004 },
  [S3StorageTier.INFREQUENT_ACCESS]: { writePer1000: 0.01, readPer1000: 0.001 },
  [S3StorageTier.ONE_ZONE_IA]: { writePer1000: 0.01, readPer1000: 0.001 },
  [S3StorageTier.GLACIER_INSTANT]: { writePer1000: 0.01, readPer1000: 0.0004 },
  [S3StorageTier.GLACIER_FLEXIBLE]: { writePer1000: 0.05, readPer1000: 0.05 },
  [S3StorageTier.DEEP_ARCHIVE]: { writePer1000: 0.05, readPer1000: 0.05 },
};

export function calculateRequestFees(volume: RequestVolume, tier: S3StorageTier): number {
  const rates = TIER_API_RATES[tier];
  const writeCost = (volume.writeOperations / 1000) * rates.writePer1000;
  const readCost = (volume.readOperations / 1000) * rates.readPer1000;

  return roundToDecimal(writeCost + readCost, 4);
}

export function calculateDataTransferFees(egress: NetworkEgressVolume): number {
  const AWS_GLOBAL_FREE_TIER_GB = 100;
  const REGIONAL_EGRESS_RATE = 0.02;

  const billableInternetGb = Math.max(0, egress.toInternetGb - AWS_GLOBAL_FREE_TIER_GB);
  const internetCost = evaluateTieredInternetEgress(billableInternetGb);
  const regionalCost = egress.toOtherRegionsGb * REGIONAL_EGRESS_RATE;

  return roundToDecimal(internetCost + regionalCost, 2);
}

export function calculateRetrievalFees(
  gbRetrieved: number,
  tier: S3StorageTier,
  speed = GlacierRetrievalSpeed.STANDARD,
): number {
  const ratePerGb = getRetrievalRate(tier, speed);
  return roundToDecimal(gbRetrieved * ratePerGb, 2);
}

export function calculateManagementFees(metrics: ManagedObjectCounts): number {
  const { intelligentTieringCount = 0, storageLensCount = 0, inventoryCount = 0 } = metrics;

  const intelligentTieringCost = (intelligentTieringCount / 1000) * 0.0025;
  const storageLensCost = (storageLensCount / 1000000) * 0.2;
  const inventoryCost = (inventoryCount / 1000000) * 0.0025;

  return roundToDecimal(intelligentTieringCost + storageLensCost + inventoryCost, 4);
}

function evaluateTieredInternetEgress(billableGb: number): number {
  const TIERS = [
    { limit: 9900, rate: 0.09 },
    { limit: 40000, rate: 0.085 },
    { limit: 100000, rate: 0.07 },
    { limit: Infinity, rate: 0.05 },
  ];

  return TIERS.reduce((accumulatedCost, tier) => {
    if (billableGb <= 0) return accumulatedCost;

    const operationalVolume = Math.min(billableGb, tier.limit);
    billableGb -= operationalVolume;

    return accumulatedCost + operationalVolume * tier.rate;
  }, 0);
}

function getRetrievalRate(tier: S3StorageTier, speed: GlacierRetrievalSpeed): number {
  const rates: Record<S3StorageTier, number | Record<GlacierRetrievalSpeed, number>> = {
    [S3StorageTier.STANDARD]: 0.0,
    [S3StorageTier.INFREQUENT_ACCESS]: 0.01,
    [S3StorageTier.ONE_ZONE_IA]: 0.01,
    [S3StorageTier.GLACIER_INSTANT]: 0.03,
    [S3StorageTier.GLACIER_FLEXIBLE]: {
      [GlacierRetrievalSpeed.EXPEDITED]: 0.03,
      [GlacierRetrievalSpeed.STANDARD]: 0.01,
      [GlacierRetrievalSpeed.BULK]: 0.0,
    },
    [S3StorageTier.DEEP_ARCHIVE]: {
      [GlacierRetrievalSpeed.EXPEDITED]: 0.02,
      [GlacierRetrievalSpeed.STANDARD]: 0.02,
      [GlacierRetrievalSpeed.BULK]: 0.0025,
    },
  };

  const tierRate = rates[tier];
  return typeof tierRate === "number" ? tierRate : tierRate[speed];
}

function roundToDecimal(value: number, decimalPlaces: number): number {
  return Number(value.toFixed(decimalPlaces));
}
