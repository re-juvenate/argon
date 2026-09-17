// Selection options for the S3 node. Values are the storage class names used as keys in
// src/math/s3/tiers.csv (fees, minimum duration/size, availability design).

export enum S3StorageClass {
  STANDARD = "S3 Standard",
  INTELLIGENT_TIERING_FREQUENT = "S3 Intelligent-Tiering (Frequent)",
  INTELLIGENT_TIERING_INFREQUENT = "S3 Intelligent-Tiering (Infrequent)",
  STANDARD_IA = "S3 Standard-IA",
  ONE_ZONE_IA = "S3 One Zone-IA",
  GLACIER_INSTANT_RETRIEVAL = "S3 Glacier Instant Retrieval",
  GLACIER_FLEXIBLE_RETRIEVAL = "S3 Glacier Flexible Retrieval",
  GLACIER_DEEP_ARCHIVE = "S3 Glacier Deep Archive",
  EXPRESS_ONE_ZONE = "S3 Express One Zone",
}
