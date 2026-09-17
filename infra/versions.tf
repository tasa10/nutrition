terraform {
  required_version = ">= 1.16"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.3"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.9"
    }
    vercel = {
      source  = "vercel/vercel"
      version = "~> 5.16"
    }
  }

  # Bucket is created by ./bootstrap. Backend blocks cannot reference variables.
  backend "gcs" {
    bucket = "nutrition-a20a8-tfstate"
    prefix = "prod"
  }
}
