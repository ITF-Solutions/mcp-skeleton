import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TokenStore } from "../storage/token-store.js";
import type { CacheStore } from "../storage/cache-store.js";

/**
 * Tool registration options
 *
 * EXTENSION POINT: Add additional dependencies your tools need.
 */
export interface RegisterToolsOptions {
  tokenStore: TokenStore;
  cacheStore: CacheStore;
}

/**
 * Register all MCP tools with the server.
 *
 * EXTENSION POINT: Add your custom tools here.
 * Remove the echo tool and implement your own domain-specific tools.
 */
export function registerTools(
  server: McpServer,
  options: RegisterToolsOptions
): void {
  const { tokenStore, cacheStore } = options;

  // Example tool: echo
  // This is a minimal example - replace with your own tools
  server.registerTool(
    "echo",
    {
      description: "Echoes back the provided message",
      title: "Echo",
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: "Echo tool - call with { message: 'your message' }",
          },
        ],
      };
    }
  );

  // TODO: Add your tools here
  // See skylight-mcp for examples of tools with parameters
}
