# Cloudflare Worker Deployment

Deploy the MCP server to Cloudflare Workers for serverless, globally distributed hosting with persistent KV storage.

> **Warning**: This deploys the Worker **without authentication**. Anyone with the URL can access your MCP tools. For production use, enable [OAuth authentication](oauth.md).

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed and authenticated

## Setup

### 1. Create KV Namespace

```bash
wrangler kv:namespace create "SKELETON_KV"
```

Note the `id` from the output.

### 2. Update wrangler.toml

Replace the placeholder KV namespace ID:

```toml
[[kv_namespaces]]
binding = "SKELETON_KV"
id = "<your-kv-namespace-id>"
```

### 3. Set Encryption Key

The KV store encrypts data at rest with AES-256-GCM. Set a strong encryption key:

```bash
wrangler secret put ENCRYPTION_KEY
# Enter a strong 32+ character key
```

### 4. Build and Deploy

```bash
npm run build
npx wrangler deploy
```

### 5. Verify

```bash
curl https://your-worker.your-subdomain.workers.dev/health
# {"status":"ok","mode":"remote"}
```

## Connect from Claude Desktop

### Native connector (recommended)

Go to **Settings** → **Connectors** → **Add custom connector**:

- **Name**: your server name
- **Remote MCP server URL**: `https://your-worker.your-subdomain.workers.dev/mcp`

### Config file (alternative)

```json
{
  "mcpServers": {
    "my-mcp-server": {
      "command": "npx",
      "args": ["mcp-remote", "https://your-worker.your-subdomain.workers.dev/mcp"]
    }
  }
}
```

## Adding Authentication

For production use, enable OAuth to restrict access to authorized users. See the [OAuth guide](oauth.md) for setup.

## KV Storage

Data in KV is encrypted with AES-256-GCM using PBKDF2-derived keys. The `TokenStore` handles encryption/decryption transparently — your tool code just calls `get()` and `set()`.

## Tear Down

```bash
# Delete the Worker
npx wrangler delete

# Delete KV namespace (get ID from wrangler.toml)
wrangler kv:namespace delete --namespace-id=<your-kv-namespace-id>
```
