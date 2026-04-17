# Storage Module - S3, ECR

variable "project_name" {
  type        = string
  description = "Project name for resource naming"
}

# Get current AWS account ID for globally unique bucket names
data "aws_caller_identity" "current" {}

locals {
  cache_bucket = "${var.project_name}-cache-${data.aws_caller_identity.current.account_id}"
}

# S3 Bucket for DuckDB cache
resource "aws_s3_bucket" "cache" {
  bucket        = local.cache_bucket
  force_destroy = true # Allow terraform destroy to delete non-empty bucket

  tags = {
    Name = local.cache_bucket
  }
}

resource "aws_s3_bucket_versioning" "cache" {
  bucket = aws_s3_bucket.cache.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "cache" {
  bucket = aws_s3_bucket.cache.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "cache" {
  bucket = aws_s3_bucket.cache.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 Bucket Policy - Require SSL/TLS
resource "aws_s3_bucket_policy" "cache" {
  bucket = aws_s3_bucket.cache.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "RequireSSL"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.cache.arn,
          "${aws_s3_bucket.cache.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.cache]
}

# S3 Lifecycle Policy - Cleanup old versions and incomplete uploads
resource "aws_s3_bucket_lifecycle_configuration" "cache" {
  bucket = aws_s3_bucket.cache.id

  rule {
    id     = "cleanup-old-versions"
    status = "Enabled"

    filter {} # Required to avoid deprecation warning

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"

    filter {} # Required to avoid deprecation warning

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# ECR Repository for abrg
resource "aws_ecr_repository" "abrg" {
  name                 = "abrg"
  image_tag_mutability = "MUTABLE"
  force_delete         = true # Allow terraform destroy to delete non-empty repository

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-abrg"
  }
}

# ECR Repository for abrdb
resource "aws_ecr_repository" "abrdb" {
  name                 = "abrdb"
  image_tag_mutability = "MUTABLE"
  force_delete         = true # Allow terraform destroy to delete non-empty repository

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-abrdb"
  }
}

# ECR Lifecycle Policy
resource "aws_ecr_lifecycle_policy" "abrg" {
  repository = aws_ecr_repository.abrg.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 3 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 3
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

resource "aws_ecr_lifecycle_policy" "abrdb" {
  repository = aws_ecr_repository.abrdb.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 3 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 3
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
