variable "cloudflare_api_token" {
  description = "Cloudflare API token with Access permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "cloudflare_team_name" {
  description = "Cloudflare Zero Trust team name (e.g. 'my-team' from my-team.cloudflareaccess.com)"
  type        = string
}

variable "app_name" {
  description = "Display name for the Access application (e.g. 'My MCP Server')"
  type        = string
}

variable "worker_subdomain" {
  description = "Full Workers subdomain before .workers.dev (e.g. 'my-mcp.my-account' for my-mcp.my-account.workers.dev)"
  type        = string
}

variable "allowed_emails" {
  description = "List of email addresses allowed to authenticate"
  type        = list(string)
}
