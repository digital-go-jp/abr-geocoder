# Database Module - Aurora PostgreSQL Serverless v2

variable "project_name" {
  type        = string
  description = "Project name for resource naming"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for Aurora"
}

variable "security_group_id" {
  type        = string
  description = "Security group ID for Aurora"
}

variable "database_name" {
  type        = string
  default     = "abrdb"
  description = "Initial database name"
}

variable "master_username" {
  type        = string
  default     = "abruser"
  description = "Master username"
}

variable "min_capacity" {
  type        = number
  default     = 0.5
  description = "Minimum ACU capacity"
}

variable "max_capacity" {
  type        = number
  default     = 128 # testing for全国 (#275)
  description = "Maximum ACU capacity"
}

variable "skip_final_snapshot" {
  type        = bool
  default     = true
  description = "Skip final snapshot on deletion (set false for production)"
}

variable "deletion_protection" {
  type        = bool
  default     = false
  description = "Enable deletion protection (set true for production)"
}

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-aurora-subnet-group"
  subnet_ids = var.subnet_ids

  tags = {
    Name = "${var.project_name}-aurora-subnet-group"
  }
}

# Aurora Cluster
resource "aws_rds_cluster" "main" {
  cluster_identifier = "${var.project_name}-cluster"
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  engine_version     = "17.7"
  database_name      = var.database_name
  master_username    = var.master_username

  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.security_group_id]

  serverlessv2_scaling_configuration {
    min_capacity = var.min_capacity
    max_capacity = var.max_capacity
  }

  skip_final_snapshot = var.skip_final_snapshot
  deletion_protection = var.deletion_protection

  tags = {
    Name = "${var.project_name}-cluster"
  }
}

# Aurora Instance
resource "aws_rds_cluster_instance" "main" {
  cluster_identifier = aws_rds_cluster.main.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.main.engine
  engine_version     = aws_rds_cluster.main.engine_version

  tags = {
    Name = "${var.project_name}-instance"
  }
}
