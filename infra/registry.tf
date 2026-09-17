resource "google_artifact_registry_repository" "api" {
  location      = var.region
  repository_id = "nutrition"
  format        = "DOCKER"
  description   = "Container images for the nutrition API"

  # Keep the registry within the free storage allowance: only the latest few images survive.
  cleanup_policy_dry_run = false

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 3
    }
  }

  cleanup_policies {
    id     = "delete-old"
    action = "DELETE"
    condition {
      older_than = "2592000s" # 30 days
    }
  }

  depends_on = [google_project_service.apis["artifactregistry.googleapis.com"]]
}
