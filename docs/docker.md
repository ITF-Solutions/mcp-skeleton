# Docker Deployment

Run the MCP server as a Docker container with HTTP transport. Suitable for VPS, home server, or local multi-client testing.

## Quick Start

```bash
docker-compose up
```

Test:

```bash
curl http://localhost:3000/health
# {"status":"ok","mode":"remote"}
```

## Connect from Claude Desktop

### Native connector

Claude Desktop supports remote MCP servers natively. Go to **Settings** → **Connectors** → **Add custom connector**:

- **Name**: your server name
- **Remote MCP server URL**: `http://localhost:3000/mcp` (or your server's public URL)

### Config file (alternative)

Use [mcp-remote](https://www.npmjs.com/package/mcp-remote) to bridge stdio to HTTP:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "my-mcp-server": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:3000/mcp"]
    }
  }
}
```

## Custom Docker Build

```bash
# Build the image
docker build -t my-mcp-server .

# Run with environment variables
docker run -p 3000:3000 \
  -e MCP_MODE=http \
  -e PORT=3000 \
  my-mcp-server
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_MODE` | Must be `http` for Docker | `stdio` |
| `PORT` | HTTP server port | `3000` |
| `HOST` | HTTP server host | `0.0.0.0` |

## Without Docker

Run the HTTP server directly with Node.js:

```bash
npm run build
MCP_MODE=http PORT=3000 npm run mcp:http
```

Or in development mode with hot reload:

```bash
npm run dev:http
```

## Limitations

- **No persistence**: In-memory storage only. Data is lost on container restart.
- **No authentication**: The HTTP endpoint is open. Add a reverse proxy (nginx, Caddy) for auth if needed.

For persistent storage and built-in authentication, see [Cloudflare Worker](cloudflare-worker.md) deployment.
