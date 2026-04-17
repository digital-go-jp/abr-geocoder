variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "nlb_arn" {
  description = "NLB ARN for VPC Link"
  type        = string
}

variable "nlb_dns_name" {
  description = "NLB DNS name for integration URI"
  type        = string
}

variable "stage_name" {
  description = "API Gateway stage name"
  type        = string
  default     = "v3"
}

variable "log_retention_days" {
  type        = number
  default     = 30
  description = "CloudWatch Logs retention in days"
}

variable "cors_allow_origin" {
  type        = string
  default     = "'*'"
  description = "CORS Access-Control-Allow-Origin value (restrict to specific domains in production, e.g. \"'https://example.com'\")"
}

