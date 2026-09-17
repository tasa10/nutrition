variable "project_id" {
  description = "GCP project. The Firebase project is a GCP project, so the same ID is used."
  type        = string
  default     = "nutrition-a20a8"
}

variable "region" {
  type    = string
  default = "asia-northeast1"
}

variable "github_repo" {
  description = "GitHub repository (owner/name) allowed to deploy via Workload Identity Federation."
  type        = string
  default     = "tasa10/nutrition"
}

variable "service_name" {
  type    = string
  default = "nutrition-api"
}

variable "postgres_version" {
  type    = string
  default = "POSTGRES_18"
}

variable "db_tier" {
  description = "Cloud SQL machine tier. db-f1-micro is the cheapest shared-core option."
  type        = string
  default     = "db-f1-micro"
}

variable "ai_provider" {
  type    = string
  default = "gemini"
}

variable "ai_model" {
  description = "Empty uses the backend's per-provider default."
  type        = string
  default     = ""
}

variable "ai_api_key" {
  description = "API key for the AI provider. Stored in Secret Manager and Terraform state."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.ai_api_key) > 0
    error_message = "ai_api_key must be set (the backend needs it to call the AI provider)."
  }
}

# Firebase web app config (Firebase Console > Project settings > Your apps). Public by design.
variable "firebase_web_api_key" {
  type = string
}

variable "firebase_auth_domain" {
  type    = string
  default = "nutrition-a20a8.firebaseapp.com"
}

variable "firebase_app_id" {
  type = string
}

variable "vercel_project_name" {
  description = "Also determines the default production URL: https://<name>.vercel.app"
  type        = string
  default     = "nutrition"
}

variable "frontend_url" {
  description = "Production origin allowed by CORS. Defaults to the Vercel project URL; set this when using a custom domain."
  type        = string
  default     = null
}

locals {
  frontend_url = coalesce(var.frontend_url, "https://${var.vercel_project_name}.vercel.app")
  image_repo   = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.api.repository_id}"
}
