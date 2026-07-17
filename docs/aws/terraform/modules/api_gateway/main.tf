# API Gateway REST API with VPC Link to NLB
# Uses native API Key authentication with Usage Plans

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.project_name}"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project_name}-api-logs"
  }
}

# VPC Link for REST API (connects to NLB)
resource "aws_api_gateway_vpc_link" "main" {
  name        = "${var.project_name}-vpc-link"
  target_arns = [var.nlb_arn]

  tags = {
    Name = "${var.project_name}-vpc-link"
  }
}

# REST API
resource "aws_api_gateway_rest_api" "main" {
  name        = "${var.project_name}-api"
  description = "REST API for ${var.project_name}"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = {
    Name = "${var.project_name}-api"
  }
}

# Proxy Resource (catches all paths)
resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "{proxy+}"
}

# GET method for proxy resource (all endpoints are GET only)
resource "aws_api_gateway_method" "proxy" {
  rest_api_id      = aws_api_gateway_rest_api.main.id
  resource_id      = aws_api_gateway_resource.proxy.id
  http_method      = "GET"
  authorization    = "NONE"
  api_key_required = true

  request_parameters = {
    "method.request.path.proxy" = true
  }
}

# Integration with NLB via VPC Link
resource "aws_api_gateway_integration" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.proxy.id
  http_method = aws_api_gateway_method.proxy.http_method

  type                    = "HTTP_PROXY"
  integration_http_method = "GET"
  uri                     = "http://${var.nlb_dns_name}/{proxy}"
  connection_type         = "VPC_LINK"
  connection_id           = aws_api_gateway_vpc_link.main.id

  request_parameters = {
    "integration.request.path.proxy" = "method.request.path.proxy"
  }
}

# --- CORS: OPTIONS method for proxy resource ---
resource "aws_api_gateway_method" "proxy_options" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "proxy_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.proxy.id
  http_method = aws_api_gateway_method.proxy_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "proxy_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.proxy.id
  http_method = aws_api_gateway_method.proxy_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }

  response_models = {
    "application/json" = "Empty"
  }
}

resource "aws_api_gateway_integration_response" "proxy_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.proxy.id
  http_method = aws_api_gateway_method.proxy_options.http_method
  status_code = aws_api_gateway_method_response.proxy_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-API-Key'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = var.cors_allow_origin
  }
}

# Root resource method (for / endpoint)
resource "aws_api_gateway_method" "root" {
  rest_api_id      = aws_api_gateway_rest_api.main.id
  resource_id      = aws_api_gateway_rest_api.main.root_resource_id
  http_method      = "GET"
  authorization    = "NONE"
  api_key_required = true
}

# Root integration
resource "aws_api_gateway_integration" "root" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_rest_api.main.root_resource_id
  http_method = aws_api_gateway_method.root.http_method

  type                    = "HTTP_PROXY"
  integration_http_method = "GET"
  uri                     = "http://${var.nlb_dns_name}/"
  connection_type         = "VPC_LINK"
  connection_id           = aws_api_gateway_vpc_link.main.id
}

# --- CORS: OPTIONS method for root resource ---
resource "aws_api_gateway_method" "root_options" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_rest_api.main.root_resource_id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "root_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_rest_api.main.root_resource_id
  http_method = aws_api_gateway_method.root_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "root_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_rest_api.main.root_resource_id
  http_method = aws_api_gateway_method.root_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }

  response_models = {
    "application/json" = "Empty"
  }
}

resource "aws_api_gateway_integration_response" "root_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_rest_api.main.root_resource_id
  http_method = aws_api_gateway_method.root_options.http_method
  status_code = aws_api_gateway_method_response.root_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-API-Key'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = var.cors_allow_origin
  }
}

# Deployment
resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.proxy.id,
      aws_api_gateway_method.proxy.id,
      aws_api_gateway_integration.proxy.id,
      aws_api_gateway_method.proxy_options.id,
      aws_api_gateway_integration.proxy_options.id,
      aws_api_gateway_method.root.id,
      aws_api_gateway_integration.root.id,
      aws_api_gateway_method.root_options.id,
      aws_api_gateway_integration.root_options.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_method.proxy,
    aws_api_gateway_integration.proxy,
    aws_api_gateway_integration_response.proxy_options,
    aws_api_gateway_method.root,
    aws_api_gateway_integration.root,
    aws_api_gateway_integration_response.root_options,
  ]
}

# Stage
resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = var.stage_name

  xray_tracing_enabled = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      resourcePath   = "$context.resourcePath"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      apiKeyId       = "$context.identity.apiKeyId"
    })
  }

  tags = {
    Name = "${var.project_name}-${var.stage_name}"
  }
}

# Method Settings
resource "aws_api_gateway_method_settings" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  stage_name  = aws_api_gateway_stage.main.stage_name
  method_path = "*/*"

  settings {
    logging_level   = "INFO"
    metrics_enabled = true
  }
}

# API Key
resource "aws_api_gateway_api_key" "main" {
  name    = "${var.project_name}-api-key"
  enabled = true

  tags = {
    Name = "${var.project_name}-api-key"
  }
}

# Usage Plan
resource "aws_api_gateway_usage_plan" "main" {
  name        = "${var.project_name}-usage-plan"
  description = "Usage plan for ${var.project_name}"

  api_stages {
    api_id = aws_api_gateway_rest_api.main.id
    stage  = aws_api_gateway_stage.main.stage_name
  }

  # Uncomment and adjust based on your usage requirements
  # throttle_settings {
  #   rate_limit  = 100  # requests per second
  #   burst_limit = 200
  # }
  # quota_settings {
  #   limit  = 10000
  #   period = "DAY"
  # }

  tags = {
    Name = "${var.project_name}-usage-plan"
  }
}

# Link API Key to Usage Plan
resource "aws_api_gateway_usage_plan_key" "main" {
  key_id        = aws_api_gateway_api_key.main.id
  key_type      = "API_KEY"
  usage_plan_id = aws_api_gateway_usage_plan.main.id
}

# Store API Key in Secrets Manager
resource "aws_secretsmanager_secret" "api_key" {
  name                    = "${var.project_name}-api-key"
  recovery_window_in_days = 0 # Allow immediate deletion on terraform destroy

  tags = {
    Name = "${var.project_name}-api-key"
  }
}

resource "aws_secretsmanager_secret_version" "api_key" {
  secret_id     = aws_secretsmanager_secret.api_key.id
  secret_string = aws_api_gateway_api_key.main.value
}

