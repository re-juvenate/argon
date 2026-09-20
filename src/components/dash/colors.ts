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
  [ServiceType.Client]: "#6e6e1d",
  [ServiceType.Region]: "#147eba",
}
