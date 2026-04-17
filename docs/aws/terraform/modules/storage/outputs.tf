output "cache_bucket_name" {
  value = aws_s3_bucket.cache.bucket
}

output "cache_bucket_arn" {
  value = aws_s3_bucket.cache.arn
}

output "abrg_repository_url" {
  value = aws_ecr_repository.abrg.repository_url
}

output "abrdb_repository_url" {
  value = aws_ecr_repository.abrdb.repository_url
}
