# stdio Mode

The simplest way to run the MCP server. Claude Desktop spawns it as a child process and communicates over stdin/stdout.

## Setup

### 1. Build

```bash
npm install
npm run build
```

### 2. Configure Claude Desktop

Add to your Claude Desktop config:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "my-mcp-server": {
      "command": "node",
      "args": ["/absolute/path/to/dist/cli.js"]
    }
  }
}
```

### 3. Restart Claude Desktop

The server starts automatically when Claude Desktop opens. Check **Settings** → **Developer** → **MCP Servers** to verify the connection.

## How It Works

- Claude Desktop runs `node dist/cli.js` as a subprocess
- Communication happens over stdin/stdout (no network)
- Storage is in-memory — data is lost when the process stops
- The process lifecycle is tied to Claude Desktop

## Development

For development with hot reload:

```bash
npm run dev
```

This uses `tsx watch` to restart the server on file changes. Note that Claude Desktop won't automatically reconnect — you'll need to restart it or use the MCP inspector for development.

## Limitations

- **No persistence**: In-memory storage only. Data is lost on restart.
- **Single client**: One Claude Desktop instance per server process.
- **Local only**: No network access — the server runs on the same machine as Claude Desktop.

For persistent storage or multi-client support, see [Docker](docker.md) or [Cloudflare Worker](cloudflare-worker.md) deployment.
