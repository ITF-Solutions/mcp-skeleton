# Cloudflare Access Setup

Configure Cloudflare Access as the OIDC identity provider for the [Worker OAuth mode](oauth.md). Access is a natural fit since it's already part of your Cloudflare account, but the Worker's OAuth implementation works with any OIDC-compatible provider — if you use Auth0, Okta, or another IdP, skip this guide and provide the equivalent URLs in the Worker secrets.

## What This Creates

| Resource | Purpose |
|----------|---------|
| **Access Application (SaaS/OIDC)** | OIDC provider — auto-generates client ID, client secret, and the authorize/token/JWKS URLs |
| **Access Policy** | Controls who can authenticate (e.g. specific emails, email domains, IP ranges) |

After setup, users authenticate via Cloudflare Access (email OTP, or any IdP you've configured in Zero Trust), and the Worker verifies the resulting JWT.

## Prerequisites

- Cloudflare account with [Zero Trust](https://one.dash.cloudflare.com/) enabled (free tier works)
- A team name configured in Zero Trust (e.g. `your-team` → `your-team.cloudflareaccess.com`)

## Terraform Setup (Recommended)

A Terraform configuration in `infrastructure/cloudflare-access/` automates the full setup. It creates the Access application and policy, then outputs all five secrets the Worker needs — no manual copying of URLs from the dashboard.

### Prerequisites

- Docker and Docker Compose (Terraform runs in a container)
- Cloudflare API token with Access permissions

### 1. Create an API Token

Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) and create a token with:

| Permission | Access Level |
|-----------|-------------|
| Account → Access: Organizations, Identity Providers, and Groups | Edit |
| Account → Access: Apps and Policies | Edit |

### 2. Configure

```bash
cd infrastructure/cloudflare-access
cp .env.example .env
cp terraform.tfvars.example terraform.tfvars
```

Edit `.env`:
```bash
CLOUDFLARE_API_TOKEN=your-api-token-here
CLOUDFLARE_ACCOUNT_ID=your-account-id-here
```

Edit `terraform.tfvars`:
```hcl
cloudflare_api_token  = "your-api-token-here"
cloudflare_account_id = "your-account-id-here"
cloudflare_team_name  = "your-team-name"
app_name              = "My MCP Server"
worker_subdomain      = "my-mcp.my-subdomain"
allowed_emails        = ["alice@example.com", "bob@example.com"]
```

### 3. Run

```bash
docker compose run --rm terraform init
docker compose run --rm terraform plan
docker compose run --rm terraform apply
```

### 4. Set Worker Secrets

Terraform outputs everything the Worker needs. Get all values at once:

```bash
docker compose run --rm terraform output -json worker_secrets_summary
```

Then set each one as a Worker secret:

```bash
wrangler secret put ACCESS_CLIENT_ID
wrangler secret put ACCESS_CLIENT_SECRET
wrangler secret put ACCESS_TOKEN_URL
wrangler secret put ACCESS_AUTHORIZATION_URL
wrangler secret put ACCESS_JWKS_URL
```

Then follow the rest of the [Worker OAuth setup guide](oauth.md).

### Customizing the Policy

Edit `infrastructure/cloudflare-access/main.tf` to change who can authenticate.

**Allow an email domain instead of individual emails:**
```hcl
include {
  email_domain = ["example.com"]
}
```

**IP allowlist:**
```hcl
include {
  ip = ["203.0.113.0/24"]
}
```

### Tear Down

```bash
docker compose run --rm terraform destroy
```

This removes the Access application and policy. It does **not** affect the Worker or KV namespaces.

## Manual Setup (Dashboard)

If you prefer not to use Terraform, you can create the Access application manually.

### 1. Create an Access Application

1. Go to [Zero Trust](https://one.dash.cloudflare.com/) → **Access** → **Applications**
2. Click **Add an Application** → **SaaS**
3. Configure:
   - **Application name**: your server name
   - **Auth type**: OIDC
   - **Redirect URL**: `https://your-worker.workers.dev/callback`
   - **Scopes**: `openid`, `email`, `profile`
4. Save the application
5. Note down the **Client ID** and **Client Secret**

The OIDC URLs follow a predictable pattern using your team name and the client ID:

| Secret | Value |
|--------|-------|
| `ACCESS_CLIENT_ID` | Shown after saving the application |
| `ACCESS_CLIENT_SECRET` | Shown after saving the application |
| `ACCESS_TOKEN_URL` | `https://<team>.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<client-id>/token` |
| `ACCESS_AUTHORIZATION_URL` | `https://<team>.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<client-id>/authorization` |
| `ACCESS_JWKS_URL` | `https://<team>.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<client-id>/jwks` |

### 2. Create an Access Policy

1. In the application settings, go to **Policies**
2. Add a policy:
   - **Name**: e.g. `Allow authorized users`
   - **Action**: Allow
   - **Include rule**: Emails — list the email addresses allowed to connect
3. Save

### 3. Set Worker Secrets

```bash
wrangler secret put ACCESS_CLIENT_ID
wrangler secret put ACCESS_CLIENT_SECRET
wrangler secret put ACCESS_TOKEN_URL
wrangler secret put ACCESS_AUTHORIZATION_URL
wrangler secret put ACCESS_JWKS_URL
```

Then follow the rest of the [Worker OAuth setup guide](oauth.md).
