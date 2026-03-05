terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# Cloudflare Access SaaS Application (OIDC)
# Creates the OIDC provider that the Worker uses for OAuth authentication.
# The client_id, client_secret, and OIDC URLs are auto-generated.
resource "cloudflare_zero_trust_access_application" "mcp" {
  account_id = var.cloudflare_account_id
  name       = var.app_name
  type       = "saas"

  saas_app {
    auth_type     = "oidc"
    redirect_uris = ["https://${var.worker_subdomain}.workers.dev/callback"]
    scopes        = ["openid", "email", "profile"]
  }
}

# Access Policy: who can authenticate
resource "cloudflare_zero_trust_access_policy" "allow" {
  application_id = cloudflare_zero_trust_access_application.mcp.id
  account_id     = var.cloudflare_account_id
  name           = "Allow authorized users"
  precedence     = 1
  decision       = "allow"

  include {
    email = var.allowed_emails
  }
}
