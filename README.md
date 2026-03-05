# mcp-skeleton

> Template for building multi-mode MCP servers (stdio, HTTP, Cloudflare Workers)

This is a GitHub template repository. Click **"Use this template"** to create your own MCP server.

## Features

- **Three runtime modes:** stdio (Claude Desktop), HTTP (Node.js), Worker (Cloudflare)
- **OAuth authentication:** Optional OAuth 2.0 via Cloudflare Access for Worker mode
- **Encrypted storage:** AES-256-GCM encryption for Cloudflare KV
- **Session management:** Per-client server instances for HTTP
- **Infrastructure as Code:** Terraform for Cloudflare Access, Docker for deployment
- **CI/CD:** Conventional commits, release-please, automated releases
- **Type-safe:** Full TypeScript support

## Quick Start

```bash
npm install
npm run build
npm run mcp:stdio
```

Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "my-mcp-server": {
      "command": "node",
      "args": ["/path/to/your-repo/dist/cli.js"]
    }
  }
}
```

## Adding Custom Tools

Replace the example `echo` tool in [`src/tools/index.ts`](src/tools/index.ts):

```typescript
server.tool(
  "my_tool",
  "Tool description",
  { arg1: { type: "string", description: "Argument description" } },
  async ({ arg1 }) => ({
    content: [{ type: "text", text: `Result: ${arg1}` }],
  })
);
```

## Project Structure

```
src/
  auth/                # OAuth handler + OIDC utilities (worker mode)
  http/app.ts          # Streamable HTTP endpoint (session management)
  entrypoints/         # Runtime-specific entrypoints
    stdio.ts           # Claude Desktop mode
    http.ts            # Node.js HTTP mode
    worker.ts          # Cloudflare Worker mode (with OAuth toggle)
  storage/             # Storage abstraction
    token-store.ts     # Key-value store (in-memory + encrypted KV)
    cache-store.ts     # Cache interface
  tools/               # MCP tools (EXTENSION POINT)
    index.ts           # Register your tools here
  config.ts            # Environment configuration (EXTENSION POINT)
docs/                  # Deployment and architecture guides
infrastructure/        # Terraform for Cloudflare Access
```

## Documentation

| Guide | Description |
|-------|-------------|
| [Transport Modes](docs/transports.md) | stdio, Streamable HTTP, and SSE — comparison, sequence diagrams, sample payloads |
| [stdio Setup](docs/stdio.md) | Claude Desktop local setup |
| [Docker Deployment](docs/docker.md) | HTTP mode with Docker |
| [Cloudflare Worker](docs/cloudflare-worker.md) | Serverless deployment with KV storage |
| [OAuth Authentication](docs/oauth.md) | OAuth 2.0 setup with sequence diagram and HTTP examples |
| [Cloudflare Access Setup](docs/cloudflare-access-setup.md) | Terraform-based OIDC provider setup |

## Development

```bash
npm run dev          # Dev mode (stdio) with hot reload
npm run dev:http     # Dev mode (HTTP) with hot reload
npm run build        # Build for Node.js
npm run build:worker # Build for Cloudflare Workers
npm test             # Run tests
npm run test:watch   # Tests in watch mode
```

## Extension Points

When building your MCP server from this template:

1. **`src/tools/index.ts`** — Replace the echo tool with your domain-specific tools
2. **`src/config.ts`** — Add custom environment variables if needed
3. **`src/storage/`** — Add custom storage methods if needed
4. **`package.json`** — Update name, description, author, keywords
5. **`README.md`** — Replace with your project documentation

## Contributing

This project enforces [Conventional Commits](https://www.conventionalcommits.org/). See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT

---

**Built from [mcp-skeleton](https://github.com/ITF-Solutions/mcp-skeleton)** — Template for multi-mode MCP servers
