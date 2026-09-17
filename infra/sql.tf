# Smallest always-on Cloud SQL instance. This is the only fixed cost in the stack.
resource "google_sql_database_instance" "main" {
  name             = "nutrition-db"
  database_version = var.postgres_version
  region           = var.region

  # Refuses `terraform destroy` while set; flip to false deliberately before tearing the stack down.
  deletion_protection = true

  settings {
    tier              = var.db_tier
    edition           = "ENTERPRISE"
    availability_type = "ZONAL"
    disk_type         = "PD_HDD"
    disk_size         = 10
    disk_autoresize   = false

    backup_configuration {
      enabled                        = true
      start_time                     = "18:00" # 03:00 JST
      point_in_time_recovery_enabled = false
      backup_retention_settings {
        retained_backups = 7
      }
    }

    # Public IP with no authorized networks: only reachable through the Cloud SQL Auth Proxy
    # (which Cloud Run uses), so no VPC connector is needed.
    ip_configuration {
      ipv4_enabled = true
      ssl_mode     = "ENCRYPTED_ONLY"
    }

    maintenance_window {
      day  = 7 # Sunday
      hour = 18
    }
  }

  depends_on = [google_project_service.apis["sqladmin.googleapis.com"]]
}

resource "google_sql_database" "app" {
  name     = "nutrition"
  instance = google_sql_database_instance.main.name
}

# No special characters so the password can be embedded in the connection URL as-is.
resource "random_password" "db" {
  length  = 32
  special = false
}

resource "google_sql_user" "app" {
  name     = "nutrition"
  instance = google_sql_database_instance.main.name
  password = random_password.db.result
}
