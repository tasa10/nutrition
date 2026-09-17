resource "google_secret_manager_secret" "database_url" {
  secret_id = "nutrition-database-url"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

# pgx connects over the Cloud SQL unix socket that Cloud Run mounts at /cloudsql/<connection name>.
resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = "postgres://${google_sql_user.app.name}:${random_password.db.result}@/${google_sql_database.app.name}?host=/cloudsql/${google_sql_database_instance.main.connection_name}&sslmode=disable"
}

resource "google_secret_manager_secret" "ai_api_key" {
  secret_id = "nutrition-ai-api-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "ai_api_key" {
  secret      = google_secret_manager_secret.ai_api_key.id
  secret_data = var.ai_api_key
}
