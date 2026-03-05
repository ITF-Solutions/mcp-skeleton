import { Hono } from "hono";
import { cors } from "hono/cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import type { TokenStore } from "../storage/token-store.js";
import type { CacheStore } from "../storage/cache-store.js";
import { registerTools } from "../tools/index.js";

// ============================================================================
// Types
// ============================================================================

export interface CreateMcpAppOptions {
  tokenStore: TokenStore;
  cacheStore: CacheStore;
}

// ============================================================================
// Hono App Factory
// ============================================================================

/**
 * Create a Hono HTTP app with MCP Streamable HTTP endpoint.
 * Uses Web Standard Streamable HTTP transport (works on Node.js, Workers, Deno, Bun).
 *
 * CRITICAL: This implements per-session server instances.
 * Each MCP client gets its own McpServer instance (not shared).
 */
export function createMcpApp(options: CreateMcpAppOptions): Hono {
  const { tokenStore, cacheStore } = options;
  const app = new Hono();

  // CORS middleware (allow all origins for MCP clients)
  app.use("/*", cors({ origin: "*" }));

  // Health check endpoint
  app.get("/health", (c) => {
    return c.json({ status: "ok", mode: "remote" });
  });

  // Store server and transport by session ID (one server instance per session)
  const sessions: Record<
    string,
    {
      server: McpServer;
      transport: WebStandardStreamableHTTPServerTransport;
    }
  > = {};

  // MCP POST endpoint handler
  app.post("/mcp", async (c) => {
    const sessionId = c.req.header("mcp-session-id");

    try {
      // Reuse existing session
      if (sessionId && sessions[sessionId]) {
        const { transport } = sessions[sessionId];
        const response = await transport.handleRequest(c.req.raw);
        return response;
      }

      // Create new session for initialize request without session ID
      if (!sessionId) {
        // Create new MCP server instance for this session
        const server = new McpServer({
          name: "mcp-skeleton",
          version: "1.0.0",
          description: "Template MCP server",
        });

        // Register all MCP tools for this server instance
        registerTools(server, { tokenStore, cacheStore });

        // Create transport
        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
        });

        // Connect server to transport
        await server.connect(transport);
        const response = await transport.handleRequest(c.req.raw);

        // Store session by session ID for future requests
        if (transport.sessionId) {
          sessions[transport.sessionId] = { server, transport };
        }

        return response;
      }

      return c.json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: invalid session ID or method",
          },
          id: null,
        },
        400
      );
    } catch (error) {
      console.error("Error handling MCP request:", error);
      return c.json(
        {
          jsonrpc: "2.0",
          error: { code: -32000, message: "Internal server error" },
          id: null,
        },
        500
      );
    }
  });

  // MCP GET endpoint handler (for streaming responses)
  app.get("/mcp", async (c) => {
    const sessionId = c.req.header("mcp-session-id");

    if (!sessionId || !sessions[sessionId]) {
      return c.json(
        {
          jsonrpc: "2.0",
          error: { code: -32000, message: "Bad Request: invalid session ID" },
          id: null,
        },
        400
      );
    }

    const { transport } = sessions[sessionId];
    const response = await transport.handleRequest(c.req.raw);
    return response;
  });

  return app;
}
