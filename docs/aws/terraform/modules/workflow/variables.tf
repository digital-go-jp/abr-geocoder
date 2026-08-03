# Workflow Module Variables

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "ecs_cluster_arn" {
  description = "ECS cluster ARN"
  type        = string
}

variable "ecs_cluster_name" {
  description = "ECS cluster name"
  type        = string
}

variable "abrdb_import_task_arn" {
  description = "Task definition ARN for abrdb import"
  type        = string
}

variable "abrg_cache_build_task_arn" {
  description = "Task definition ARN for abrg cache build"
  type        = string
}

variable "ecs_service_name" {
  description = "ECS service name for abrg"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "ecs_security_group_id" {
  description = "Security group ID for ECS tasks"
  type        = string
}

variable "schedule_expression" {
  description = "EventBridge schedule expression (cron or rate)"
  type        = string
  default     = "cron(0 2 * * ? *)" # 毎日 02:00 JST
}

variable "enable_schedule" {
  description = "Enable EventBridge schedule"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  type        = number
  default     = 30
  description = "CloudWatch Logs retention in days"
}

# Daily update task specs (lower than full import)
variable "daily_import_cpu" {
  type        = string
  default     = "2048" # 2 vCPU (the task definition allows 8)
  description = "CPU units for daily import task"
}

variable "daily_import_memory" {
  type        = string
  default     = "4096" # 4 GB (the task definition allows 16)
  description = "Memory (MB) for daily import task"
}

variable "daily_cache_build_cpu" {
  type        = string
  default     = "4096" # 4 vCPU (the task definition allows 8)
  description = "CPU units for daily cache build task"
}

variable "daily_cache_build_memory" {
  type        = string
  default     = "16384" # 16 GB (the task definition allows 32)
  description = "Memory (MB) for daily cache build task"
}

variable "force_import_timeout_seconds" {
  type        = number
  default     = 2700 # covers a full re-import, measured at 14 min
  description = "Timeout for the full re-import triggered by {\"force\": true}"
}
