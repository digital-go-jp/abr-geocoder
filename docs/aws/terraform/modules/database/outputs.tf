output "cluster_endpoint" {
  value = aws_rds_cluster.main.endpoint
}

output "database_name" {
  value = aws_rds_cluster.main.database_name
}

output "master_username" {
  value = aws_rds_cluster.main.master_username
}

output "master_user_secret_arn" {
  value = aws_rds_cluster.main.master_user_secret[0].secret_arn
}
