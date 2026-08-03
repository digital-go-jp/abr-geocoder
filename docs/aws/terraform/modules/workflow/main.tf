# Workflow Module - Step Functions + EventBridge for automated data updates
#
# Workflow:
#   EventBridge (schedule) -> Step Functions -> ECS Tasks -> ECS Service restart
#
# Steps:
#   1. abrdb import (check & import if changes)
#   2. abrg cache build
#   3. ECS service force-new-deployment
#
# Note: Daily updates use lower task specs via Overrides (2vCPU/4GB for import,
#       4vCPU/8GB for cache build). For full imports, run tasks manually with
#       default specs (16vCPU/32GB) or override via aws ecs run-task.

# IAM Role for Step Functions
resource "aws_iam_role" "step_functions" {
  name = "${var.project_name}-sfn-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-sfn-role"
  }
}

resource "aws_iam_role_policy" "step_functions" {
  name = "${var.project_name}-sfn-policy"
  role = aws_iam_role.step_functions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Resource = "*" with Condition is the AWS-recommended pattern for ECS
        # task actions, as task ARNs are not known before execution.
        # See: https://docs.aws.amazon.com/step-functions/latest/dg/ecs-iam.html
        Effect = "Allow"
        Action = [
          "ecs:RunTask",
          "ecs:StopTask",
          "ecs:DescribeTasks"
        ]
        Resource = "*"
        Condition = {
          ArnEquals = {
            "ecs:cluster" = var.ecs_cluster_arn
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:UpdateService"
        ]
        Resource = "arn:aws:ecs:*:*:service/${var.ecs_cluster_name}/${var.ecs_service_name}"
      },
      {
        # Resource = "*" with Condition is the AWS-recommended pattern for
        # iam:PassRole when used with ECS tasks.
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = "*"
        Condition = {
          StringLike = {
            "iam:PassedToService" = "ecs-tasks.amazonaws.com"
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "events:PutTargets",
          "events:PutRule",
          "events:DescribeRule"
        ]
        Resource = "arn:aws:events:*:*:rule/StepFunctionsGetEventsForECSTaskRule"
      },
      {
        # Resource = "*" is required for CloudWatch Logs delivery APIs.
        # These actions do not support resource-level permissions.
        # See: https://docs.aws.amazon.com/step-functions/latest/dg/cw-logs.html
        Effect = "Allow"
        Action = [
          "logs:CreateLogDelivery",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups"
        ]
        Resource = "*"
      }
    ]
  })
}

# CloudWatch Log Group for Step Functions
resource "aws_cloudwatch_log_group" "step_functions" {
  name              = "/aws/stepfunctions/${var.project_name}-data-update"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project_name}-sfn-logs"
  }
}

locals {
  # Every task state in this workflow runs on the same private subnets with
  # the same security group, so the wiring is declared once here.
  task_network_configuration = {
    AwsvpcConfiguration = {
      Subnets        = var.private_subnet_ids
      SecurityGroups = [var.ecs_security_group_id]
      AssignPublicIp = "DISABLED"
    }
  }
}

# Step Functions State Machine
resource "aws_sfn_state_machine" "data_update" {
  name     = "${var.project_name}-data-update"
  role_arn = aws_iam_role.step_functions.arn

  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.step_functions.arn}:*"
    include_execution_data = true
    level                  = "ERROR"
  }

  definition = jsonencode({
    Comment = "ABR data update workflow: check changes -> import -> cache build -> service restart"
    StartAt = "Route"
    States = {
      # Manual releases enter here. The scheduled run carries both keys set to
      # false and falls through to CheckChanges.
      #
      # Each key is guarded by IsPresent because a Choice that reads an absent
      # path fails the execution itself. BooleanEquals also means the string
      # "true" does not match and lands on the default branch, so the input
      # has to carry real booleans.
      Route = {
        Type = "Choice"
        Choices = [
          {
            And = [
              {
                Variable  = "$.rebuild_cache_only"
                IsPresent = true
              },
              {
                Variable      = "$.rebuild_cache_only"
                BooleanEquals = true
              }
            ]
            Next = "BuildCache"
          },
          {
            And = [
              {
                Variable  = "$.force"
                IsPresent = true
              },
              {
                Variable      = "$.force"
                BooleanEquals = true
              }
            ]
            Next = "ForceImport"
          }
        ]
        Default = "CheckChanges"
      }
      # abrdb import detects unchanged files and skips them, so a plain import
      # cannot re-run the ETL after a logic change. --force deletes and
      # re-inserts per file, replacing rows an older logic produced.
      #
      # No Cpu/Memory override: the daily values are sized for an incremental
      # import and a full one runs out of memory under them. The task
      # definition's own spec applies instead.
      ForceImport = {
        Type           = "Task"
        Resource       = "arn:aws:states:::ecs:runTask.sync"
        TimeoutSeconds = var.force_import_timeout_seconds
        Parameters = {
          Cluster              = var.ecs_cluster_arn
          TaskDefinition       = var.abrdb_import_task_arn
          LaunchType           = "FARGATE"
          NetworkConfiguration = local.task_network_configuration
          Overrides = {
            ContainerOverrides = [
              {
                Name    = "abrdb"
                Command = ["import", "--force", "--quiet"]
                Environment = [
                  { Name = "LOG_LEVEL", Value = "info" }
                ]
              }
            ]
          }
        }
        Next = "BuildCache"
      }
      # Step 1: Check for changes (dry-run)
      # - exit 0: no changes -> end workflow
      # - exit 1: changes pending -> continue to import (caught as task failure)
      #
      # TimeoutSeconds exists to stop the workflow blocking forever on a hung
      # task (e.g. an uncancellable DuckDB query), not to flag a slow one. On
      # timeout the execution fails and Step Functions attempts a best-effort
      # cancellation (ecs:StopTask) of the .sync task; the stop itself is not
      # guaranteed. A hung task costs nothing while it hangs - the service
      # keeps serving the cache it already loaded - whereas a timeout that
      # fires on a healthy run fails the update. Each value therefore covers
      # the worst case that task can legitimately reach, which is a different
      # quantity for each of them and is noted where they are set.
      #
      # Comparing the DCAT feed against the catalog costs the same whatever
      # changed, so this one only has to cover its own spread.
      CheckChanges = {
        Type           = "Task"
        Resource       = "arn:aws:states:::ecs:runTask.sync"
        TimeoutSeconds = 300
        Parameters = {
          Cluster              = var.ecs_cluster_arn
          TaskDefinition       = var.abrdb_import_task_arn
          LaunchType           = "FARGATE"
          NetworkConfiguration = local.task_network_configuration
          Overrides = {
            Cpu    = "1024"
            Memory = "2048"
            ContainerOverrides = [
              {
                Name    = "abrdb"
                Command = ["import", "--dry-run"]
                Environment = [
                  { Name = "LOG_LEVEL", Value = "info" }
                ]
              }
            ]
          }
        }
        # exit 0 (no changes) -> success -> end
        Next = "NoChanges"
        # exit 1 (changes pending) and genuine errors both surface as
        # States.TaskFailed, so the exit code decides which one it was.
        # States.Timeout is deliberately not caught: a timeout must not be
        # classified as a change-detection result, so it fails the whole
        # execution loudly.
        Catch = [
          {
            ErrorEquals = ["States.TaskFailed"]
            ResultPath  = "$.error"
            Next        = "ParseCheckFailure"
          }
        ]
      }
      # The task result arrives as a JSON string, so it has to be parsed before
      # the exit code can be read.
      ParseCheckFailure = {
        Type = "Pass"
        Parameters = {
          "cause.$" = "States.StringToJson($.error.Cause)"
        }
        ResultPath = "$.parsed"
        Next       = "ClassifyCheckFailure"
      }
      # Only exit 1 means changes are pending. Anything else (a crashed
      # container, an ECS API rejection) must fail loudly instead of being
      # mistaken for new data and triggering a full import and cache rebuild.
      ClassifyCheckFailure = {
        Type = "Choice"
        Choices = [
          {
            And = [
              {
                Variable  = "$.parsed.cause.Containers[0].ExitCode"
                IsPresent = true
              },
              {
                Variable      = "$.parsed.cause.Containers[0].ExitCode"
                NumericEquals = 1
              }
            ]
            Next = "UpdateData"
          }
        ]
        Default = "CheckChangesFailed"
      }
      CheckChangesFailed = {
        Type  = "Fail"
        Error = "CheckChangesFailed"
        Cause = "abrdb import --dry-run did not report a change-detection result"
      }
      NoChanges = {
        Type    = "Succeed"
        Comment = "No changes detected, workflow complete"
      }
      # Step 2: Import data (with changes detected)
      # An ordinary day is a minute or two, but this scales with how much ABR
      # republished, so the case to cover is every file changing at once. That
      # is the same work ForceImport does, and it runs here under the smaller
      # daily spec - not proportionally slower, since import throughput is
      # bound by Aurora writes rather than CPU.
      UpdateData = {
        Type           = "Task"
        Resource       = "arn:aws:states:::ecs:runTask.sync"
        TimeoutSeconds = 3600
        Parameters = {
          Cluster              = var.ecs_cluster_arn
          TaskDefinition       = var.abrdb_import_task_arn
          LaunchType           = "FARGATE"
          NetworkConfiguration = local.task_network_configuration
          Overrides = {
            Cpu    = var.daily_import_cpu
            Memory = var.daily_import_memory
            ContainerOverrides = [
              {
                Name    = "abrdb"
                Command = ["import", "--quiet"]
                Environment = [
                  { Name = "LOG_LEVEL", Value = "info" }
                ]
              }
            ]
          }
        }
        Next = "BuildCache"
      }
      # Step 3: Build cache
      # Every run rebuilds the whole cache, so there is no busy day to allow
      # for - only the spread between runs and the dataset growing.
      BuildCache = {
        Type           = "Task"
        Resource       = "arn:aws:states:::ecs:runTask.sync"
        TimeoutSeconds = 1800
        Parameters = {
          Cluster              = var.ecs_cluster_arn
          TaskDefinition       = var.abrg_cache_build_task_arn
          LaunchType           = "FARGATE"
          NetworkConfiguration = local.task_network_configuration
          Overrides = {
            Cpu    = var.daily_cache_build_cpu
            Memory = var.daily_cache_build_memory
          }
        }
        Next = "RestartService"
      }
      # Step 4: Restart service
      RestartService = {
        Type           = "Task"
        Resource       = "arn:aws:states:::aws-sdk:ecs:updateService"
        TimeoutSeconds = 600
        Parameters = {
          Cluster            = var.ecs_cluster_name
          Service            = var.ecs_service_name
          ForceNewDeployment = true
        }
        End = true
      }
    }
  })

  tags = {
    Name = "${var.project_name}-data-update"
  }
}

# IAM Role for EventBridge
resource "aws_iam_role" "eventbridge" {
  count = var.enable_schedule ? 1 : 0
  name  = "${var.project_name}-eventbridge-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "scheduler.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-eventbridge-role"
  }
}

resource "aws_iam_role_policy" "eventbridge" {
  count = var.enable_schedule ? 1 : 0
  name  = "${var.project_name}-eventbridge-policy"
  role  = aws_iam_role.eventbridge[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "states:StartExecution"
        Resource = aws_sfn_state_machine.data_update.arn
      }
    ]
  })
}

# EventBridge Scheduler
resource "aws_scheduler_schedule" "daily_update" {
  count = var.enable_schedule ? 1 : 0
  name  = "${var.project_name}-daily-update"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = var.schedule_expression
  schedule_expression_timezone = "Asia/Tokyo"

  target {
    arn      = aws_sfn_state_machine.data_update.arn
    role_arn = aws_iam_role.eventbridge[0].arn

    # Both keys are spelled out so the Route choice sees them present and
    # false rather than absent.
    input = jsonencode({
      force              = false
      rebuild_cache_only = false
    })
  }

  state = "ENABLED"
}
