terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # S3 backend - bucket/dynamodb_table/region is passed via -backend-config
  backend "s3" {
    key     = "terraform.tfstate"
    encrypt = true
  }
}

provider "aws" {
  region = local.aws_region

  default_tags {
    tags = {
      Project   = local.project_name
      ManagedBy = "terraform"
    }
  }
}

locals {
  project_name        = "abrg"
  aws_region          = "ap-northeast-1"
  api_stage_name      = "v3"
  deletion_protection = true
  skip_final_snapshot = false
  enable_schedule     = true

  abrg_cpu           = "2048" # 2 vCPU
  abrg_memory        = "8192" # 8 GB
  log_level          = "info"
  log_retention_days = 30

  # Fed to both the API Gateway preflight and the serve task, which each answer
  # a different half of a CORS exchange. Public read-only API, so every origin
  # is allowed.
  cors_allow_origin = "*"
}

module "network" {
  source = "./modules/network"

  project_name = local.project_name
}

module "database" {
  source = "./modules/database"

  project_name      = local.project_name
  vpc_id            = module.network.vpc_id
  subnet_ids        = module.network.private_subnet_ids
  security_group_id = module.network.aurora_security_group_id

  deletion_protection = local.deletion_protection
  skip_final_snapshot = local.skip_final_snapshot
}

module "storage" {
  source = "./modules/storage"

  project_name = local.project_name
}

module "ecs" {
  source = "./modules/ecs"

  project_name          = local.project_name
  vpc_id                = module.network.vpc_id
  private_subnet_ids    = module.network.private_subnet_ids
  ecs_security_group_id = module.network.ecs_security_group_id

  abrg_repository_url  = module.storage.abrg_repository_url
  abrdb_repository_url = module.storage.abrdb_repository_url
  cache_bucket_name    = module.storage.cache_bucket_name
  cache_bucket_arn     = module.storage.cache_bucket_arn

  db_host       = module.database.cluster_endpoint
  db_name       = module.database.database_name
  db_username   = module.database.master_username
  db_secret_arn = module.database.master_user_secret_arn

  abrg_cpu           = local.abrg_cpu
  abrg_memory        = local.abrg_memory
  log_level          = local.log_level
  log_retention_days = local.log_retention_days
  cors_allow_origin  = local.cors_allow_origin
}

module "api_gateway" {
  source = "./modules/api_gateway"

  project_name = local.project_name
  nlb_arn      = module.ecs.nlb_arn
  nlb_dns_name = module.ecs.nlb_dns_name

  stage_name         = local.api_stage_name
  log_retention_days = local.log_retention_days
  cors_allow_origin  = local.cors_allow_origin
}

module "workflow" {
  source = "./modules/workflow"

  project_name              = local.project_name
  ecs_cluster_arn           = module.ecs.cluster_arn
  ecs_cluster_name          = module.ecs.cluster_name
  abrdb_import_task_arn     = module.ecs.abrdb_import_task_arn
  abrg_cache_build_task_arn = module.ecs.abrg_cache_build_task_arn
  ecs_service_name          = module.ecs.service_name
  private_subnet_ids        = module.network.private_subnet_ids
  ecs_security_group_id     = module.network.ecs_security_group_id

  enable_schedule = local.enable_schedule
}

output "cache_bucket" {
  value = module.storage.cache_bucket_name
}

output "abrg_repository_url" {
  value = module.storage.abrg_repository_url
}

output "abrdb_repository_url" {
  value = module.storage.abrdb_repository_url
}

output "ecs_cluster_name" {
  value = module.ecs.cluster_name
}

output "private_subnet_ids" {
  value = module.network.private_subnet_ids
}

output "ecs_security_group_id" {
  value = module.network.ecs_security_group_id
}

output "api_gateway_endpoint" {
  value = module.api_gateway.api_endpoint
}

output "api_key_value" {
  value     = module.api_gateway.api_key_value
  sensitive = true
}
