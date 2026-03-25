output "ecr_repository_urls" {
  description = "ECR repository URLs for each service"
  value       = { for k, v in aws_ecr_repository.services : k => v.repository_url }
}
