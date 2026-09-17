# Frontend on Vercel (Hobby plan). The Vercel GitHub app must be installed on the repository once,
# by hand, before this project can link to it.
resource "vercel_project" "frontend" {
  name           = var.vercel_project_name
  framework      = "nextjs"
  root_directory = "frontend"

  git_repository = {
    type              = "github"
    repo              = var.github_repo
    production_branch = "main"
  }
}

# Baked into the static build, so a change here needs a redeploy on Vercel to take effect.
# Preview deployments get the same values but are not in the API's CORS allow-list (production only).
resource "vercel_project_environment_variables" "frontend" {
  project_id = vercel_project.frontend.id

  variables = [
    {
      key       = "NEXT_PUBLIC_API_URL"
      value     = google_cloud_run_v2_service.api.uri
      target    = ["production", "preview"]
      sensitive = false
    },
    {
      key       = "NEXT_PUBLIC_FIREBASE_API_KEY"
      value     = var.firebase_web_api_key
      target    = ["production", "preview"]
      sensitive = false
    },
    {
      key       = "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
      value     = var.firebase_auth_domain
      target    = ["production", "preview"]
      sensitive = false
    },
    {
      key       = "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
      value     = var.project_id
      target    = ["production", "preview"]
      sensitive = false
    },
    {
      key       = "NEXT_PUBLIC_FIREBASE_APP_ID"
      value     = var.firebase_app_id
      target    = ["production", "preview"]
      sensitive = false
    },
  ]
}
