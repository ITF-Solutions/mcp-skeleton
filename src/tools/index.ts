import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z as zod } from "zod";
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
      inputSchema: {
        message: zod.string().describe("Message to echo back"),
      },
    },
    async ({ message }) => {
      return {
        content: [
          {
            type: "text",
            text: `Echo: ${message}`,
          },
        ],
      };
    }
  );

  // TODO: Add your tools here
  // Example:
  //
  // server.registerTool(
  //   "my_tool",
  //   {
  //     description: "Description of what my tool does",
  //     title: "My Tool",
  //     inputSchema: {
  //       arg1: zod.string().describe("Description of arg1"),
  //       arg2: zod.number().optional().describe("Optional numeric argument"),
  //     },
  //   },
  //   async ({ arg1, arg2 }) => {
  //     // Your tool implementation
  //     const result = await someApiCall(arg1, arg2);
  //
  //     return {
  //       content: [
  //         {
  //           type: "text",
  //           text: `Result: ${result}`,
  //         },
  //       ],
  //     };
  //   }
  // );
}
