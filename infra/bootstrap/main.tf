# One-time bootstrap: creates the GCS bucket that holds the main Terraform state.
# Uses local state itself (kept out of git); run once, then never again unless the bucket is lost.

terraform {
  required_version = ">= 1.16"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.3"
    }
  }
}

variable "project_id" {
  type    = string
  default = "nutrition-a20a8"
}

variable "region" {
  type    = string
  default = "asia-northeast1"
}

# Must match backend "gcs" bucket in ../versions.tf (backend blocks cannot use variables).
variable "bucket_name" {
  type    = string
  default = "nutrition-a20a8-tfstate"
}

provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_storage_bucket" "tfstate" {
  name                        = var.bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      num_newer_versions = 10
      with_state         = "ARCHIVED"
    }
  }
}

output "bucket" {
  value = google_storage_bucket.tfstate.name
}
