output "cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "cluster_arn" {
  value = aws_ecs_cluster.main.arn
}

output "nlb_arn" {
  value = aws_lb.nlb.arn
}

output "nlb_dns_name" {
  value = aws_lb.nlb.dns_name
}

output "service_name" {
  value = aws_ecs_service.abrg.name
}

output "abrdb_import_task_arn" {
  value = aws_ecs_task_definition.abrdb_import.arn
}

output "abrg_cache_build_task_arn" {
  value = aws_ecs_task_definition.abrg_cache_build.arn
}
