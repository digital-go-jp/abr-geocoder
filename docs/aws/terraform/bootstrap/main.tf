# Bootstrap - Terraform State Backend
#
# Creates S3 bucket and DynamoDB table for Terraform state management.
# Run this before other Terraform modules.
#
# Usage:
#   cd docs/aws/terraform/bootstrap
#   terraform init
#   terraform apply

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

variable "region" {
  type        = string
  default     = "ap-northeast-1"
  description = "AWS region"
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = "abrg"
      ManagedBy = "terraform"
    }
  }
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

locals {
  bucket_name = "abrg-tfstate-${data.aws_caller_identity.current.account_id}"
  table_name  = "abrg-terraform-lock"
}

# S3 Bucket for Terraform State
resource "aws_s3_bucket" "terraform_state" {
  bucket = local.bucket_name

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name = local.bucket_name
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Lifecycle Policy - Cleanup incomplete multipart uploads
resource "aws_s3_bucket_lifecycle_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# DynamoDB Table for State Locking
resource "aws_dynamodb_table" "terraform_lock" {
  name         = local.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Name = local.table_name
  }
}

# Outputs
output "bucket_name" {
  value       = aws_s3_bucket.terraform_state.bucket
  description = "S3 bucket name for Terraform state"
}

output "dynamodb_table_name" {
  value       = aws_dynamodb_table.terraform_lock.name
  description = "DynamoDB table name for state locking"
}

output "backend_config" {
  value       = <<-EOT
    # Initialize with:
    #   terraform init \
    #     -backend-config="bucket=abrg-tfstate-$(aws sts get-caller-identity --query Account --output text)" \
    #     -backend-config="dynamodb_table=abrg-terraform-lock"
  EOT
  description = "Backend initialization command for environments"
}
