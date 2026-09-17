# Identity the API runs as: may open the Cloud SQL socket and read its two secrets, nothing else.
resource "google_service_account" "run" {
  account_id   = "nutrition-run"
  display_name = "nutrition API (Cloud Run runtime)"
}

resource "google_project_iam_member" "run_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.run.email}"
}

resource "google_secret_manager_secret_iam_member" "run_database_url" {
  secret_id = google_secret_manager_secret.database_url.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run.email}"
}

resource "google_secret_manager_secret_iam_member" "run_ai_api_key" {
  secret_id = google_secret_manager_secret.ai_api_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run.email}"
}

resource "google_cloud_run_v2_service" "api" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  # Nothing irreplaceable lives in the service itself (data is in Cloud SQL), so allow destroy.
  deletion_protection = false

  template {
    service_account = google_service_account.run.email

    # min 0 keeps the bill at zero when idle, at the cost of a cold start on the first request.
    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }

    containers {
      # Placeholder so the service can be created before any API image exists.
      # The real image is pushed and deployed by .github/workflows/deploy.yml; see ignore_changes below.
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      env {
        name  = "AUTH_MODE"
        value = "firebase"
      }
      env {
        name  = "FIREBASE_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "CORS_ORIGIN"
        value = local.frontend_url
      }
      env {
        name  = "AI_PROVIDER"
        value = var.ai_provider
      }
      env {
        name  = "AI_MODEL"
        value = var.ai_model
      }
      # Pinned to the exact version (not "latest") so that rotating a secret changes the template
      # and rolls a new revision; secrets are only read at container start.
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = google_secret_manager_secret_version.database_url.version
          }
        }
      }
      env {
        name = "AI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.ai_api_key.secret_id
            version = google_secret_manager_secret_version.ai_api_key.version
          }
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }
    }
  }

  lifecycle {
    # Image rollouts are owned by CI (gcloud run deploy); Terraform owns everything else.
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  depends_on = [
    google_project_service.apis["run.googleapis.com"],
    google_secret_manager_secret_version.database_url,
    google_secret_manager_secret_version.ai_api_key,
    google_secret_manager_secret_iam_member.run_database_url,
    google_secret_manager_secret_iam_member.run_ai_api_key,
    google_project_iam_member.run_cloudsql,
  ]
}

# The API is public; every request is still authenticated by the app (Firebase ID token).
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.api.name
  location = google_cloud_run_v2_service.api.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
