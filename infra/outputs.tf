output "api_url" {
  description = "Cloud Run URL of the API (HTTPS, no load balancer needed)."
  value       = google_cloud_run_v2_service.api.uri
}

output "frontend_url" {
  description = "Origin the API allows via CORS; add it to Firebase Auth authorized domains."
  value       = local.frontend_url
}

output "image_repository" {
  description = "Push API images here (see .github/workflows/deploy.yml)."
  value       = local.image_repo
}

output "cloud_sql_connection_name" {
  value = google_sql_database_instance.main.connection_name
}

# Paste these two into the GitHub repository secrets used by deploy.yml.
output "github_secret_GCP_WORKLOAD_IDENTITY_PROVIDER" {
  value = google_iam_workload_identity_pool_provider.github.name
}

output "github_secret_GCP_DEPLOY_SERVICE_ACCOUNT" {
  value = google_service_account.deploy.email
}

output "vercel_project_id" {
  value = vercel_project.frontend.id
}
