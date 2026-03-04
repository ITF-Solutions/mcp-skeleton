# mcp-skeleton

> Template for building multi-mode MCP servers (stdio, HTTP/SSE, Cloudflare Workers)

This is a GitHub template repository. Click **"Use this template"** to create your own MCP server.

## Features

- ✅ **Three runtime modes:** stdio (Claude Desktop), HTTP (Node.js), Worker (Cloudflare)
- ✅ **Storage abstraction:** In-memory or Cloudflare KV
- ✅ **Session management:** Per-client server instances for HTTP/SSE
- ✅ **Infrastructure as Code:** Docker, docker-compose, wrangler
- ✅ **CI/CD:** Conventional commits, release-please, automated releases
- ✅ **Type-safe:** Full TypeScript support

## Quick Start

### 1. Use this template

Click **"Use this template"** on GitHub to create your own repository.

### 2. Install dependencies

```bash
npm install
```

### 3. Run in stdio mode (Claude Desktop)

```bash
npm run build
npm run mcp:stdio
```

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

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

### 4. Run in HTTP mode (local testing)

```bash
MCP_MODE=http PORT=3000 npm run mcp:http
```

Test with mcp-remote:

```bash
npx mcp-remote http://localhost:3000/sse
```

Or test the health endpoint:

```bash
curl http://localhost:3000/health
# {"status":"ok","mode":"remote"}
```

### 5. Run with Docker

```bash
docker-compose up
```

Test with:

```bash
curl http://localhost:3000/health
npx mcp-remote http://localhost:3000/sse
```

## Adding Custom Tools

The template includes a simple `echo` tool as an example. Replace it with your own tools by editing [`src/tools/index.ts`](src/tools/index.ts):

```typescript
export function registerTools(server: McpServer, options: RegisterToolsOptions) {
  const { tokenStore, cacheStore } = options;

  // Your custom tool
  server.tool(
    "my_tool",
    "Tool description",
    {
      arg1: {
        type: "string",
        description: "Argument description",
      },
    },
    async ({ arg1 }) => {
      // Tool implementation
      return {
        content: [
          {
            type: "text",
            text: `Result: ${arg1}`,
          },
        ],
      };
    }
  );
}
```

## Project Structure

```
src/
  http/app.ts          # HTTP/SSE endpoint (session management) - 100% boilerplate
  entrypoints/         # Runtime-specific entrypoints
    stdio.ts           # Claude Desktop mode
    http.ts            # Node.js HTTP mode
    worker.ts          # Cloudflare Worker mode
  storage/             # Storage abstraction
    token-store.ts     # Key-value store interface
    cache-store.ts     # Cache interface
  tools/               # MCP tools (EXTENSION POINT)
    index.ts           # Register your tools here
  config.ts            # Environment configuration (EXTENSION POINT)
  cli.ts               # stdio entry point
  http-server.ts       # HTTP entry point
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode (stdio) with hot reload
npm run dev

# Run in development mode (HTTP) with hot reload
npm run dev:http

# Build everything
npm run build

# Build for Cloudflare Workers
npm run build:worker

# Type check
npm run typecheck

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Deployment

### Docker

```bash
# Build the image
docker build -t my-mcp-server .

# Run
docker run -p 3000:3000 my-mcp-server
```

### Cloudflare Workers

1. **Create KV namespace:**

```bash
wrangler kv:namespace create "SKELETON_KV"
```

2. **Update `wrangler.toml`** with the KV namespace ID from step 1

3. **Set encryption key:**

```bash
wrangler secret put ENCRYPTION_KEY
# Enter a strong 32+ character key
```

4. **Deploy:**

```bash
npm run deploy
```

5. **Test:**

```bash
curl https://your-worker.your-subdomain.workers.dev/health
```

## Configuration

Environment variables (create a `.env` file from `.env.example`):

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_MODE` | Runtime mode: `stdio`, `http`, or `worker` | `stdio` |
| `PORT` | HTTP server port (http mode) | `3000` |
| `HOST` | HTTP server host (http mode) | `localhost` |
| `ENCRYPTION_KEY` | Encryption key for KV storage (worker mode) | Required for worker |

## Extension Points

When building your MCP server from this template:

1. **Replace the echo tool** in [`src/tools/index.ts`](src/tools/index.ts) with your domain-specific tools
2. **Add environment variables** in [`src/config.ts`](src/config.ts) if needed
3. **Update package.json** with your project name, description, author
4. **Update this README** with your project documentation
5. **Optionally add custom storage methods** in [`src/storage/`](src/storage/) if needed

## Contributing

This project enforces [Conventional Commits](https://www.conventionalcommits.org/). All commit messages and PR titles **must** follow this format:

```
<type>(<optional scope>): <description>
```

| Type | Purpose |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `chore` | Maintenance, dependencies, CI |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `ci` | CI/CD pipeline changes |

Examples:

```
feat: add new MCP tool for data processing
fix(storage): handle KV timeout errors
docs: update deployment guide
chore: bump dependencies
```

PR titles are validated in CI - builds will not run if the title does not follow conventional commits.

Release versions are managed automatically by [release-please](https://github.com/googleapis/release-please) based on commit types (`feat` = minor, `fix` = patch).

## Architecture

### Session Management

The HTTP/SSE transport uses **per-session server instances**. Each MCP client connection gets its own `McpServer` instance (not shared). This is critical for proper session isolation.

See [`src/http/app.ts`](src/http/app.ts) for the implementation.

### Storage Abstraction

Storage is abstracted with interfaces:

- **`TokenStore`** - Key-value storage for tokens/state
- **`CacheStore`** - TTL-based caching

Implementations:

- **In-memory** (stdio, http modes) - No persistence between restarts
- **Cloudflare KV** (worker mode) - Persistent storage

### Three Runtime Modes

| Mode | Transport | Storage | Use Case |
|------|-----------|---------|----------|
| **stdio** | StdioServerTransport | In-memory | Claude Desktop (local) |
| **http** | WebStandardStreamableHTTPServerTransport | In-memory | Local testing, Docker |
| **worker** | WebStandardStreamableHTTPServerTransport | Cloudflare KV | Production (serverless) |

## License

MIT

---

**Built from [mcp-skeleton](https://github.com/ITF-Solutions/mcp-skeleton)** - Template for multi-mode MCP servers
