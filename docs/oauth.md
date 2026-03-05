# Cloudflare Worker with OAuth

Secure the Worker with OAuth 2.0 so only authorized users can connect. The Worker acts as both an MCP server and an OAuth authorization server — MCP clients authenticate through a standard OAuth flow before accessing tools.

This builds on the [basic Worker deployment](cloudflare-worker.md). Complete that setup first.

## How It Works

The Worker uses [`@cloudflare/workers-oauth-provider`](https://www.npmjs.com/package/@cloudflare/workers-oauth-provider) to handle dynamic client registration, token issuance, and token validation. The upstream identity provider (e.g. Cloudflare Access) handles actual user authentication.

### Authentication sequence

```mermaid
sequenceDiagram
    participant Client as MCP Client<br/>(Claude Desktop)
    participant Browser
    participant Worker as Worker<br/>(CF Worker)
    participant OIDC as OIDC Provider<br/>(CF Access)

    Note over Client,Worker: 1. OAuth Discovery
    Client->>Worker: POST /mcp (initialize)
    Worker-->>Client: 401 + OAuth metadata URL
    Client->>Worker: GET /.well-known/oauth-authorization-server
    Worker-->>Client: { registration, authorize, token endpoints }

    Note over Client,Worker: 2. Dynamic Client Registration
    Client->>Worker: POST /register
    Worker-->>Client: { client_id, client_secret }
    Note right of Worker: Store client in OAUTH_KV

    Note over Client,OIDC: 3. User Approval + OIDC Login
    Client->>Browser: Open browser
    Browser->>Worker: GET /authorize
    Worker-->>Browser: Approval dialog (CSRF-protected)
    Browser->>Worker: POST /authorize (user clicks Approve)
    Note right of Worker: Set approval cookie (30-day)
    Worker-->>Browser: 302 → OIDC /authorization
    Browser->>OIDC: GET /authorization (client_id, scope, state)
    OIDC-->>Browser: Login page (email OTP)
    Browser->>OIDC: User enters OTP
    OIDC-->>Browser: 302 → /callback?code=XXX&state=YYY

    Note over Browser,OIDC: 4. Token Exchange + JWT Verification
    Browser->>Worker: GET /callback?code=XXX&state=YYY
    Worker->>OIDC: POST /token (exchange auth code)
    OIDC-->>Worker: { access_token, id_token (JWT) }
    Worker->>OIDC: GET /jwks
    OIDC-->>Worker: { signing keys }
    Note right of Worker: Verify JWT signature + expiry
    Note right of Worker: Store grant + MCP token in OAUTH_KV
    Worker-->>Browser: 302 (auth code back to client)
    Browser-->>Client: Auth code

    Note over Client,Worker: 5. MCP Token Issuance
    Client->>Worker: POST /token (exchange auth code)
    Worker-->>Client: { mcp_access_token }

    rect rgb(34, 139, 34, 0.1)
        Note over Client,OIDC: AUTH COMPLETE — all subsequent requests use the MCP access token
    end

    Note over Client,OIDC: 6. Authenticated Tool Calls
    Client->>Worker: POST /mcp (tool call)<br/>Authorization: Bearer <token>
    Note right of Worker: Validate token from OAUTH_KV
    Worker-->>Client: MCP tool result
```

### Key points

- **OAuth tokens** live in `OAUTH_KV` — managed by `@cloudflare/workers-oauth-provider`
- **Application data** lives in the main KV namespace — encrypted with AES-256-GCM
- **Approval cookie** (30-day) means returning clients skip the approval dialog and go straight to the OIDC provider

### HTTP request/response examples

Each step of the authentication sequence shown above, with example requests and responses.

<details>
<summary><strong>Step 1 — OAuth Discovery</strong></summary>

**1a. MCP client sends an unauthenticated request:**

```http
POST /mcp HTTP/1.1
Host: your-worker.workers.dev
Content-Type: application/json

{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"claude-desktop","version":"1.0.0"}},"id":1}
```

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://your-worker.workers.dev/.well-known/oauth-protected-resource"
```

**1b. Client fetches the protected resource metadata:**

```http
GET /.well-known/oauth-protected-resource HTTP/1.1
Host: your-worker.workers.dev
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "resource": "https://your-worker.workers.dev",
  "authorization_servers": ["https://your-worker.workers.dev"]
}
```

**1c. Client fetches the OAuth authorization server metadata:**

```http
GET /.well-known/oauth-authorization-server HTTP/1.1
Host: your-worker.workers.dev
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "issuer": "https://your-worker.workers.dev",
  "authorization_endpoint": "https://your-worker.workers.dev/authorize",
  "token_endpoint": "https://your-worker.workers.dev/token",
  "registration_endpoint": "https://your-worker.workers.dev/register",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code"],
  "token_endpoint_auth_methods_supported": ["client_secret_post"],
  "code_challenge_methods_supported": ["S256"]
}
```

</details>

<details>
<summary><strong>Step 2 — Dynamic Client Registration</strong></summary>

The MCP client registers itself to obtain a `client_id` and `client_secret`.

```http
POST /register HTTP/1.1
Host: your-worker.workers.dev
Content-Type: application/json

{
  "client_name": "claude-desktop",
  "redirect_uris": ["http://localhost:8976/oauth/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "client_secret_post"
}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "client_id": "abc123-generated-id",
  "client_secret": "generated-secret-value",
  "client_name": "claude-desktop",
  "redirect_uris": ["http://localhost:8976/oauth/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "client_secret_post"
}
```

The client info is stored in `OAUTH_KV` and used for all subsequent token operations.

</details>

<details>
<summary><strong>Step 3 — User Approval + OIDC Login</strong></summary>

**3a. Client opens the browser to the authorization endpoint:**

```http
GET /authorize?client_id=abc123-generated-id&redirect_uri=http%3A%2F%2Flocalhost%3A8976%2Foauth%2Fcallback&response_type=code&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256&state=client-state-xyz HTTP/1.1
Host: your-worker.workers.dev
```

```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Set-Cookie: __Host-CSRF_TOKEN=<uuid>; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600
X-Frame-Options: DENY
Content-Security-Policy: frame-ancestors 'none'

<!-- HTML approval dialog showing:
     Server: "MCP Server"
     Client: "claude-desktop" is requesting access
     [Cancel] [Approve] buttons -->
```

If the client was previously approved (cookie present), this step is skipped and the user is redirected directly to the OIDC provider.

**3b. User clicks Approve — form POST with CSRF token:**

```http
POST /authorize HTTP/1.1
Host: your-worker.workers.dev
Content-Type: application/x-www-form-urlencoded
Cookie: __Host-CSRF_TOKEN=<uuid>

state=<base64-encoded-oauth-state>&csrf_token=<uuid>
```

```http
HTTP/1.1 302 Found
Location: https://your-team.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<app-id>/authorization?client_id=<access-client-id>&redirect_uri=https%3A%2F%2Fyour-worker.workers.dev%2Fcallback&response_type=code&scope=openid+email+profile&state=<state-token>
Set-Cookie: __Host-APPROVED_CLIENTS=<signature>.<base64-payload>; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=2592000
```

The approval cookie lasts 30 days. On return visits, the user skips the approval dialog.

**3c. OIDC provider handles login (e.g. email OTP via Cloudflare Access):**

The browser follows the redirect to the OIDC provider's login page. After the user authenticates, the provider redirects back:

```http
HTTP/1.1 302 Found
Location: https://your-worker.workers.dev/callback?code=oidc-auth-code-xxx&state=<state-token>
```

</details>

<details>
<summary><strong>Step 4 — Token Exchange + JWT Verification</strong></summary>

**4a. Browser follows the redirect to `/callback`:**

```http
GET /callback?code=oidc-auth-code-xxx&state=<state-token> HTTP/1.1
Host: your-worker.workers.dev
```

**4b. Worker exchanges the OIDC code for tokens (server-to-server):**

```http
POST /cdn-cgi/access/sso/oidc/<app-id>/token HTTP/1.1
Host: your-team.cloudflareaccess.com
Content-Type: application/x-www-form-urlencoded

client_id=<access-client-id>&client_secret=<access-client-secret>&code=oidc-auth-code-xxx&grant_type=authorization_code&redirect_uri=https%3A%2F%2Fyour-worker.workers.dev%2Fcallback
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "access_token": "oidc-access-token",
  "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6Ijk3ODc1...<JWT>",
  "token_type": "bearer",
  "expires_in": 86400
}
```

**4c. Worker fetches JWKS and verifies the `id_token` JWT:**

```http
GET /cdn-cgi/access/sso/oidc/<app-id>/jwks HTTP/1.1
Host: your-team.cloudflareaccess.com
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "keys": [
    {
      "kty": "RSA",
      "kid": "97875...",
      "alg": "RS256",
      "n": "...",
      "e": "AQAB",
      "use": "sig"
    }
  ]
}
```

The Worker verifies the JWT signature with RSASSA-PKCS1-v1_5 + SHA-256 and checks expiry. Then it completes the OAuth authorization and redirects the browser back to the MCP client with an auth code:

```http
HTTP/1.1 302 Found
Location: http://localhost:8976/oauth/callback?code=mcp-auth-code-yyy&state=client-state-xyz
```

</details>

<details>
<summary><strong>Step 5 — MCP Token Issuance</strong></summary>

The MCP client exchanges its auth code for an access token:

```http
POST /token HTTP/1.1
Host: your-worker.workers.dev
Content-Type: application/x-www-form-urlencoded

client_id=abc123-generated-id&client_secret=generated-secret-value&code=mcp-auth-code-yyy&grant_type=authorization_code&redirect_uri=http%3A%2F%2Flocalhost%3A8976%2Foauth%2Fcallback&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "access_token": "mcp-access-token-zzz",
  "token_type": "bearer"
}
```

This is the MCP access token — all subsequent `/mcp` requests use this in the `Authorization` header.

</details>

<details>
<summary><strong>Step 6 — Authenticated Tool Calls</strong></summary>

With the MCP access token, the client can now make authenticated MCP requests:

```http
POST /mcp HTTP/1.1
Host: your-worker.workers.dev
Content-Type: application/json
Authorization: Bearer mcp-access-token-zzz

{"jsonrpc":"2.0","method":"tools/call","params":{"name":"my_tool","arguments":{"arg1":"value"}},"id":2}
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"jsonrpc":"2.0","result":{"content":[{"type":"text","text":"Tool result here"}]},"id":2}
```

</details>

## Prerequisites

1. Working [basic Worker deployment](cloudflare-worker.md) (KV, secrets, deployed)
2. An OIDC provider, set up **before** starting this guide — you need its client ID, client secret, and endpoint URLs. Options:
   - **[Cloudflare Access](cloudflare-access-setup.md)** (recommended) — already in your Cloudflare account, Terraform outputs all the values
   - **Other providers** (Auth0, Okta, etc.) — provide the equivalent client ID, client secret, authorization URL, token URL, and JWKS URL

> **Order matters**: set up your OIDC provider first (e.g. run Terraform for Cloudflare Access), then come back here to configure the Worker with those values.

## Setup

### 1. Create OAuth KV Namespace

OAuth needs its own KV namespace for state and token storage (separate from the application data KV).

```bash
wrangler kv:namespace create "OAUTH_KV"
```

### 2. Update wrangler.toml

Uncomment the OAuth KV binding and enable OAuth:

```toml
[vars]
OAUTH_ENABLED = "true"

# Application data KV
[[kv_namespaces]]
binding = "SKELETON_KV"
id = "<your-kv-id>"

# OAuth KV (for state and token storage)
[[kv_namespaces]]
binding = "OAUTH_KV"
id = "<your-oauth-kv-id>"
```

### 3. Set OAuth Secrets

These come from your OIDC provider. If using Cloudflare Access, see [Cloudflare Access Setup](cloudflare-access-setup.md) to get these values.

```bash
# OIDC provider credentials
wrangler secret put ACCESS_CLIENT_ID
wrangler secret put ACCESS_CLIENT_SECRET

# OIDC provider URLs
wrangler secret put ACCESS_TOKEN_URL
wrangler secret put ACCESS_AUTHORIZATION_URL
wrangler secret put ACCESS_JWKS_URL

# Random string for signing approval cookies
openssl rand -hex 32 | wrangler secret put COOKIE_ENCRYPTION_KEY
```

**Example values (Cloudflare Access):**

| Secret | Example |
|--------|---------|
| `ACCESS_CLIENT_ID` | `abcdef1234567890.access` |
| `ACCESS_CLIENT_SECRET` | `long-random-secret-from-access` |
| `ACCESS_TOKEN_URL` | `https://your-team.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<app-id>/token` |
| `ACCESS_AUTHORIZATION_URL` | `https://your-team.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<app-id>/authorization` |
| `ACCESS_JWKS_URL` | `https://your-team.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<app-id>/jwks` |

### 4. Deploy

```bash
npm run build
npx wrangler deploy
```

### 5. Verify

```bash
# Should get an OAuth challenge (not a direct MCP response)
curl -X POST https://your-worker.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}'
```

Expected: `401 Unauthorized` with a `WWW-Authenticate` header.

## Claude Desktop Configuration

### Native connector (recommended)

Claude Desktop supports remote MCP servers natively. Go to **Settings** → **Connectors** → **Add custom connector**:

- **Name**: your server name
- **Remote MCP server URL**: `https://your-worker.workers.dev/mcp`

On first connect, Claude Desktop opens a browser for OAuth authentication. After approval, the connection is automatic on future sessions.

### Config file (alternative)

Use [mcp-remote](https://www.npmjs.com/package/mcp-remote) to bridge stdio to HTTP:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "my-mcp-server": {
      "command": "npx",
      "args": ["mcp-remote", "https://your-worker.workers.dev/mcp"]
    }
  }
}
```

`mcp-remote` handles the OAuth challenge automatically — it will open a browser window on first connection.

## Approval Dialog

On first connection, the Worker shows an approval dialog asking you to authorize the MCP client. Once approved, a cookie remembers your choice for 30 days.

The dialog shows:
- The MCP client name (from dynamic client registration)
- The server name
- An approve/cancel option

After approval, you're redirected to your OIDC provider to authenticate (e.g. email OTP via Cloudflare Access).

## Security Notes

- **Token storage**: OAuth state and tokens are stored in the `OAUTH_KV` namespace. Application data remains in the separate main KV namespace.
- **CSRF protection**: The approval dialog uses `__Host-` prefixed cookies with `HttpOnly`, `Secure`, and `SameSite=Lax` flags.
- **JWT verification**: The callback verifies the ID token signature against the provider's JWKS and checks expiry.
- **Cookie signing**: Approval cookies are signed with HMAC-SHA256 using `COOKIE_ENCRYPTION_KEY`.

## Switching Between Modes

To switch back to the basic (no-auth) Worker:

```toml
[vars]
OAUTH_ENABLED = "false"
```

Then redeploy. The `OAUTH_ENABLED` flag is a runtime toggle — the OAuth code is always bundled but only active when the flag is `"true"`.
