import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTokenStore } from "../storage/token-store.js";
import { InMemoryCacheStore } from "../storage/cache-store.js";
import { registerTools } from "../tools/index.js";

/**
 * Stdio mode entrypoint - for Claude Desktop
 *
 * This creates a single MCP server instance connected via stdio transport.
 * Uses in-memory storage (no persistence between restarts).
 */
export async function startStdioServer(): Promise<void> {
  const tokenStore = new InMemoryTokenStore();
  const cacheStore = new InMemoryCacheStore();

  const server = new McpServer({
    name: "mcp-skeleton",
    version: "1.0.0",
    description: "Template MCP server",
  });

  registerTools(server, { tokenStore, cacheStore });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Graceful shutdown
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });
}
