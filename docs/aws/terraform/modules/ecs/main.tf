# ECS Module - Cluster, Task Definitions, Service, NLB

variable "project_name" {
  type        = string
  description = "Project name for resource naming"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for ECS"
}

variable "ecs_security_group_id" {
  type        = string
  description = "Security group ID for ECS"
}

variable "abrg_repository_url" {
  type        = string
  description = "ECR repository URL for abrg"
}

variable "abrdb_repository_url" {
  type        = string
  description = "ECR repository URL for abrdb"
}

variable "cache_bucket_name" {
  type        = string
  description = "S3 bucket name for DuckDB cache"
}

variable "cache_bucket_arn" {
  type        = string
  description = "S3 bucket ARN for DuckDB cache"
}

variable "db_host" {
  type        = string
  description = "Aurora endpoint"
}

variable "db_name" {
  type        = string
  description = "Database name"
}

variable "db_username" {
  type        = string
  description = "Database username"
}

variable "db_secret_arn" {
  type        = string
  description = "Secrets Manager ARN for DB password"
}

variable "abrg_cpu" {
  type        = string
  description = "CPU units for abrg server (256, 512, 1024, 2048, 4096)"
  default     = "512" # 0.5 vCPU
}

variable "abrg_memory" {
  type        = string
  description = "Memory (MB) for abrg server"
  default     = "1024" # 1 GB
}

variable "abrg_min_count" {
  type        = number
  description = "Minimum number of abrg tasks"
  default     = 1
}

variable "abrg_max_count" {
  type        = number
  description = "Maximum number of abrg tasks"
  default     = 3
}

variable "abrg_cpu_target" {
  type        = number
  description = "Target CPU utilization (%) for auto scaling"
  default     = 70
}

variable "abrg_memory_target" {
  type        = number
  description = "Target memory utilization (%) for auto scaling"
  default     = 80
}

variable "abrdb_cpu" {
  type        = string
  description = "CPU units for abrdb tasks (1024, 2048, 4096, 8192, 16384)"
  default     = "8192" # 8 vCPU: import throughput is bound by Aurora writes, not CPU
}

variable "abrdb_memory" {
  type        = string
  description = "Memory (MB) for abrdb tasks"
  default     = "16384" # 16 GB
}

variable "cache_build_cpu" {
  type        = string
  description = "CPU units for cache build task (1024, 2048, 4096, 8192, 16384)"
  default     = "8192" # 8 vCPU
}

variable "cache_build_memory" {
  type        = string
  description = "Memory (MB) for cache build task"
  default     = "32768" # 32 GB - needed for tmpfs + DuckDB processing
}

variable "log_retention_days" {
  type        = number
  default     = 7
  description = "CloudWatch Logs retention in days"
}

variable "cors_allow_origin" {
  # Must match the value given to the API Gateway module: preflight is answered
  # there while the response to the actual GET comes from this service.
  type        = string
  default     = "*"
  description = "CORS Access-Control-Allow-Origin value the serve task returns"
}

variable "log_level" {
  type        = string
  default     = "debug"
  description = "Log level for abrg/abrdb (debug, info, warn, error)"
}

# Data sources
data "aws_region" "current" {}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${var.project_name}-cluster"
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "abrg" {
  name              = "/ecs/${var.project_name}/abrg"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project_name}-abrg-logs"
  }
}

resource "aws_cloudwatch_log_group" "abrdb" {
  name              = "/ecs/${var.project_name}/abrdb"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project_name}-abrdb-logs"
  }
}

# IAM Role for ECS Task Execution
resource "aws_iam_role" "ecs_execution" {
  name = "${var.project_name}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-ecs-execution-role"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${var.project_name}-ecs-execution-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [var.db_secret_arn]
      }
    ]
  })
}

# IAM Role for ECS Task
resource "aws_iam_role" "ecs_task" {
  name = "${var.project_name}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-ecs-task-role"
  }
}

resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "${var.project_name}-ecs-task-s3"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "${var.cache_bucket_arn}/abrg/*"
      }
    ]
  })
}

# Task Definition: abrg server
resource "aws_ecs_task_definition" "abrg" {
  family                   = "abrg"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.abrg_cpu
  memory                   = var.abrg_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([
    {
      name      = "abrg"
      image     = "${var.abrg_repository_url}:latest"
      essential = true

      entryPoint = ["/bin/sh", "-c"]
      command = [
        "aws s3 cp --only-show-errors s3://${var.cache_bucket_name}/abrg/abrg.duckdb.gz /tmp/ && gunzip /tmp/abrg.duckdb.gz && /app/abrg serve"
      ]

      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "PORT", value = "3000" },
        { name = "GIN_MODE", value = "release" },
        { name = "CACHE_PATH", value = "/tmp/abrg.duckdb" },
        { name = "CORS_ALLOW_ORIGIN", value = var.cors_allow_origin }
      ]

      # Use ephemeral storage instead of tmpfs (cache file is ~6 GB)
      readonlyRootFilesystem = false

      healthCheck = {
        command     = ["CMD-SHELL", "curl -sf http://localhost:3000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 300 # 5 min: cache download (~2 min) + gunzip (~1 min) + startup
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.abrg.name
          "awslogs-region"        = data.aws_region.current.region
          "awslogs-stream-prefix" = "server"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-abrg"
  }
}

# Task Definition: abrdb import
resource "aws_ecs_task_definition" "abrdb_import" {
  family                   = "abrdb-import"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.abrdb_cpu
  memory                   = var.abrdb_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([
    {
      name      = "abrdb"
      image     = "${var.abrdb_repository_url}:latest"
      essential = true
      command   = ["import"]

      environment = [
        { name = "HOME", value = "/tmp" }, # DuckDB needs writable home for ~/.duckdb
        { name = "DB_HOST", value = var.db_host },
        { name = "DB_PORT", value = "5432" },
        { name = "DB_USER", value = var.db_username },
        { name = "DB_NAME", value = var.db_name },
        { name = "DB_SSLMODE", value = "require" },
        { name = "ABRDB_DOWNLOAD_DIR", value = "/tmp/downloads" },
        { name = "LOG_LEVEL", value = var.log_level },
        { name = "ABRDB_PREF", value = "all" },
        { name = "ABRDB_CATEGORY", value = "all" },
        { name = "ABRDB_POS", value = "true" }
      ]

      readonlyRootFilesystem = true

      linuxParameters = {
        tmpfs = [
          {
            containerPath = "/tmp"
            size          = 8192 # 8 GB for ABR data download
          }
        ]
      }

      secrets = [
        {
          name      = "DB_PASSWORD"
          valueFrom = "${var.db_secret_arn}:password::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.abrdb.name
          "awslogs-region"        = data.aws_region.current.region
          "awslogs-stream-prefix" = "import"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-abrdb-import"
  }
}

# Task Definition: abrg cache build
resource "aws_ecs_task_definition" "abrg_cache_build" {
  family                   = "abrg-cache-build"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cache_build_cpu
  memory                   = var.cache_build_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  ephemeral_storage {
    size_in_gib = 40
  }

  container_definitions = jsonencode([
    {
      name      = "abrg"
      image     = "${var.abrg_repository_url}:latest"
      essential = true

      entryPoint = ["/bin/sh", "-c"]
      command = [
        "/app/abrg cache build --cache /tmp/abrg.duckdb && pigz /tmp/abrg.duckdb && aws s3 cp --only-show-errors /tmp/abrg.duckdb.gz s3://${var.cache_bucket_name}/abrg/abrg.duckdb.gz"
      ]

      environment = [
        { name = "HOME", value = "/tmp" }, # DuckDB needs writable home for ~/.duckdb
        { name = "DB_HOST", value = var.db_host },
        { name = "DB_PORT", value = "5432" },
        { name = "DB_USER", value = var.db_username },
        { name = "DB_NAME", value = var.db_name },
        { name = "DB_SSLMODE", value = "require" },
        { name = "LOG_LEVEL", value = var.log_level }
      ]

      # cache-build needs large temp storage for DuckDB, use ephemeral storage instead of tmpfs
      readonlyRootFilesystem = false

      secrets = [
        {
          name      = "DB_PASSWORD"
          valueFrom = "${var.db_secret_arn}:password::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.abrdb.name
          "awslogs-region"        = data.aws_region.current.region
          "awslogs-stream-prefix" = "cache-build"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-abrg-cache-build"
  }
}

# NLB (for API Gateway VPC Link)
resource "aws_lb" "nlb" {
  name               = "${var.project_name}-nlb"
  internal           = true
  load_balancer_type = "network"
  subnets            = var.private_subnet_ids

  tags = {
    Name = "${var.project_name}-nlb"
  }
}

# NLB Target Group (points to ECS directly)
resource "aws_lb_target_group" "nlb" {
  name        = "${var.project_name}-nlb-tg"
  port        = 3000
  protocol    = "TCP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    interval            = 30
    protocol            = "HTTP"
    path                = "/health"
    port                = "traffic-port"
  }

  tags = {
    Name = "${var.project_name}-nlb-tg"
  }
}

# NLB Listener
# Uses TCP/80 for internal VPC traffic (API Gateway -> VPC Link -> NLB -> ECS).
# For production environments requiring end-to-end encryption, consider using
# TLS listener with an ACM certificate.
resource "aws_lb_listener" "nlb" {
  load_balancer_arn = aws_lb.nlb.arn
  port              = 80
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.nlb.arn
  }
}

# ECS Service
resource "aws_ecs_service" "abrg" {
  name            = "abrg-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.abrg.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  # abrg refuses to start on a cache it cannot read, so a deployment that
  # pairs a new binary with an incompatible cache would otherwise retry
  # forever. The circuit breaker stops it and returns to the last deployment
  # that reached steady state.
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.nlb.arn
    container_name   = "abrg"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.nlb]

  tags = {
    Name = "${var.project_name}-abrg-service"
  }

  lifecycle {
    ignore_changes = [desired_count]
  }
}

# Auto Scaling for abrg service
resource "aws_appautoscaling_target" "abrg" {
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.abrg.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = var.abrg_min_count
  max_capacity       = var.abrg_max_count
}

resource "aws_appautoscaling_policy" "abrg_cpu" {
  name               = "${var.project_name}-abrg-cpu-scaling"
  service_namespace  = aws_appautoscaling_target.abrg.service_namespace
  resource_id        = aws_appautoscaling_target.abrg.resource_id
  scalable_dimension = aws_appautoscaling_target.abrg.scalable_dimension
  policy_type        = "TargetTrackingScaling"

  target_tracking_scaling_policy_configuration {
    target_value       = var.abrg_cpu_target
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

# Memory-based scaling policy
resource "aws_appautoscaling_policy" "abrg_memory" {
  name               = "${var.project_name}-abrg-memory-scaling"
  service_namespace  = aws_appautoscaling_target.abrg.service_namespace
  resource_id        = aws_appautoscaling_target.abrg.resource_id
  scalable_dimension = aws_appautoscaling_target.abrg.scalable_dimension
  policy_type        = "TargetTrackingScaling"

  target_tracking_scaling_policy_configuration {
    target_value       = var.abrg_memory_target
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
  }
}
