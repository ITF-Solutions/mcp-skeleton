# Cloudflare Access — Terraform

Provisions a Cloudflare Access SaaS application (OIDC) and access policy for the MCP Worker. Outputs all the secrets the Worker needs for OAuth — client ID, client secret, and the OIDC URLs.

This does **not** deploy the Worker itself. For full setup instructions, see [docs/cloudflare-access-setup.md](../../docs/cloudflare-access-setup.md).

## Quick Start

```bash
cp .env.example .env
cp terraform.tfvars.example terraform.tfvars
# Edit both files with your values

docker compose run --rm terraform init
docker compose run --rm terraform plan
docker compose run --rm terraform apply
```

## Get Worker Secrets

After apply, get all the values you need to set as Worker secrets:

```bash
docker compose run --rm terraform output -json worker_secrets_summary
```

Or individually:

```bash
docker compose run --rm terraform output access_client_id
docker compose run --rm terraform output access_client_secret
docker compose run --rm terraform output access_token_url
docker compose run --rm terraform output access_authorization_url
docker compose run --rm terraform output access_jwks_url
```

## What It Creates

| Resource | Purpose |
|----------|---------|
| Access Application (SaaS/OIDC) | OIDC provider — generates client ID, secret, and endpoint URLs |
| Access Policy | Controls who can authenticate (email allowlist) |

## Tear Down

```bash
docker compose run --rm terraform destroy
```

Removes Access resources only — does not affect the Worker or KV namespaces.
