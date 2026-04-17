output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = aws_api_gateway_stage.main.invoke_url
}

output "api_key_value" {
  description = "API Key value"
  value       = aws_api_gateway_api_key.main.value
  sensitive   = true
}
