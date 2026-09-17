// Selection options for the EC2 node's purchasing option. Values are the keys used in
// src/math/ec2/plantype.csv (discount, commitment, reclaimable, isolation).

export enum EC2PlanType {
  ON_DEMAND = "On-Demand",
  SAVINGS_PLANS_COMPUTE = "Savings Plans (Compute)",
  SAVINGS_PLANS_EC2_INSTANCE = "Savings Plans (EC2 Instance)",
  RESERVED_INSTANCES_STANDARD = "Reserved Instances (Standard)",
  RESERVED_INSTANCES_CONVERTIBLE = "Reserved Instances (Convertible)",
  SPOT_INSTANCES = "Spot Instances",
  DEDICATED_INSTANCES = "Dedicated Instances",
  DEDICATED_HOSTS = "Dedicated Hosts",
}
