// Single source of truth for AWS service brand colors. Nodes take their
// header color from here; docked graphs take their chart color from the
// service they were dragged from.
import { ServiceType } from "../../types/math"

export const SERVICE_COLORS: Record<ServiceType, string> = {
  [ServiceType.EC2]: "#e66d00",
  [ServiceType.ECS]: "#d86613",
  [ServiceType.ASG]: "#e66d00",
  [ServiceType.LB]: "#693cc5",
  [ServiceType.SQS]: "#c72161",
  [ServiceType.Lambda]: "#d86613",
  [ServiceType.S3]: "#408723",
  [ServiceType.CloudFront]: "#693cc5",
  [ServiceType.Route53]: "#8c4fff",
  [ServiceType.Aurora]: "#3f4fd3",
  [ServiceType.EBS]: "#e66d00",
  [ServiceType.EFS]: "#408723",
  [ServiceType.RDS]: "#3b48cc",
  [ServiceType.APIGateway]: "#ff4f8b",
  [ServiceType.DynamoDB]: "#4053d6",
  [ServiceType.SNS]: "#e7157b",
  [ServiceType.ElastiCache]: "#2e27ad",
  [ServiceType.Kinesis]: "#761f8e",
  [ServiceType.Client]: "#6e6e1d",
  [ServiceType.Region]: "#147eba",
  [ServiceType.VPC]: "#147eba",
}
