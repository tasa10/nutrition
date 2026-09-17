provider "google" {
  project = var.project_id
  region  = var.region
}

# Authenticates with the VERCEL_API_TOKEN environment variable.
provider "vercel" {}
