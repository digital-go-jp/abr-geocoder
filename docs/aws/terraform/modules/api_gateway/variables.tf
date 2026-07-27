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
  # Preflight is answered here, while the response to the actual GET carries
  # whatever the backend returns, so both have to be fed the same value. Only a
  # single origin can be expressed: the MOCK integration returns one fixed
  # string and cannot reflect the request's Origin.
  type        = string
  default     = "*"
  description = "CORS Access-Control-Allow-Origin value, unquoted (e.g. \"*\" or \"https://example.com\"). Must match the value given to the ECS service."
}

