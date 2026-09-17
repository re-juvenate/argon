// Selection options for the EC2 node's instance type. Values are the AWS identifiers used as
// keys in src/math/ec2/instancetype.csv (bandwidth).

export enum EC2InstanceType {
  // t3
  T3_NANO = "t3.nano",
  T3_MICRO = "t3.micro",
  T3_SMALL = "t3.small",
  T3_MEDIUM = "t3.medium",
  T3_LARGE = "t3.large",
  T3_XLARGE = "t3.xlarge",
  T3_2XLARGE = "t3.2xlarge",

  // t4g
  T4G_NANO = "t4g.nano",
  T4G_MICRO = "t4g.micro",
  T4G_SMALL = "t4g.small",
  T4G_MEDIUM = "t4g.medium",
  T4G_LARGE = "t4g.large",
  T4G_XLARGE = "t4g.xlarge",
  T4G_2XLARGE = "t4g.2xlarge",

  // c6i
  C6I_LARGE = "c6i.large",
  C6I_XLARGE = "c6i.xlarge",
  C6I_2XLARGE = "c6i.2xlarge",
  C6I_4XLARGE = "c6i.4xlarge",
  C6I_8XLARGE = "c6i.8xlarge",
  C6I_12XLARGE = "c6i.12xlarge",
  C6I_16XLARGE = "c6i.16xlarge",
  C6I_24XLARGE = "c6i.24xlarge",
  C6I_32XLARGE = "c6i.32xlarge",

  // c7g
  C7G_MEDIUM = "c7g.medium",
  C7G_LARGE = "c7g.large",
  C7G_XLARGE = "c7g.xlarge",
  C7G_2XLARGE = "c7g.2xlarge",
  C7G_4XLARGE = "c7g.4xlarge",
  C7G_8XLARGE = "c7g.8xlarge",
  C7G_12XLARGE = "c7g.12xlarge",
  C7G_16XLARGE = "c7g.16xlarge",

  // m6i
  M6I_LARGE = "m6i.large",
  M6I_XLARGE = "m6i.xlarge",
  M6I_2XLARGE = "m6i.2xlarge",
  M6I_4XLARGE = "m6i.4xlarge",
  M6I_8XLARGE = "m6i.8xlarge",
  M6I_12XLARGE = "m6i.12xlarge",
  M6I_16XLARGE = "m6i.16xlarge",
  M6I_24XLARGE = "m6i.24xlarge",
  M6I_32XLARGE = "m6i.32xlarge",

  // m7g
  M7G_MEDIUM = "m7g.medium",
  M7G_LARGE = "m7g.large",
  M7G_XLARGE = "m7g.xlarge",
  M7G_2XLARGE = "m7g.2xlarge",
  M7G_4XLARGE = "m7g.4xlarge",
  M7G_8XLARGE = "m7g.8xlarge",
  M7G_12XLARGE = "m7g.12xlarge",
  M7G_16XLARGE = "m7g.16xlarge",

  // r6i
  R6I_LARGE = "r6i.large",
  R6I_XLARGE = "r6i.xlarge",
  R6I_2XLARGE = "r6i.2xlarge",
  R6I_4XLARGE = "r6i.4xlarge",
  R6I_8XLARGE = "r6i.8xlarge",
  R6I_12XLARGE = "r6i.12xlarge",
  R6I_16XLARGE = "r6i.16xlarge",
  R6I_24XLARGE = "r6i.24xlarge",
  R6I_32XLARGE = "r6i.32xlarge",

  // r7g
  R7G_MEDIUM = "r7g.medium",
  R7G_LARGE = "r7g.large",
  R7G_XLARGE = "r7g.xlarge",
  R7G_2XLARGE = "r7g.2xlarge",
  R7G_4XLARGE = "r7g.4xlarge",
  R7G_8XLARGE = "r7g.8xlarge",
  R7G_12XLARGE = "r7g.12xlarge",
  R7G_16XLARGE = "r7g.16xlarge",

  // i4i
  I4I_LARGE = "i4i.large",
  I4I_XLARGE = "i4i.xlarge",
  I4I_2XLARGE = "i4i.2xlarge",
  I4I_4XLARGE = "i4i.4xlarge",
  I4I_8XLARGE = "i4i.8xlarge",
  I4I_16XLARGE = "i4i.16xlarge",
  I4I_32XLARGE = "i4i.32xlarge",

  // g5
  G5_XLARGE = "g5.xlarge",
  G5_2XLARGE = "g5.2xlarge",
  G5_4XLARGE = "g5.4xlarge",
  G5_8XLARGE = "g5.8xlarge",
  G5_12XLARGE = "g5.12xlarge",
  G5_16XLARGE = "g5.16xlarge",
  G5_24XLARGE = "g5.24xlarge",
  G5_48XLARGE = "g5.48xlarge",

  // p4d
  P4D_24XLARGE = "p4d.24xlarge",
}
