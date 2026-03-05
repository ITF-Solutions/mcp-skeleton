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
  /** When true, creates a fresh server per request (no session tracking). */
  stateless?: boolean;
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
  const { tokenStore, cacheStore, stateless = false } = options;
  const app = new Hono();

  // CORS middleware
  app.use("/*", cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "mcp-session-id", "Last-Event-ID", "mcp-protocol-version"],
    exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
  }));

  // Health check endpoint
  app.get("/health", (c) => {
    return c.json({ status: "ok", mode: stateless ? "stateless" : "session" });
  });

  // Helper to create a new MCP server with tools registered
  const createServer = () => {
    const server = new McpServer({
      name: "mcp-skeleton",
      version: "1.0.0",
      description: "Template MCP server",
    });

    registerTools(server, { tokenStore, cacheStore });

    return server;
  };

  if (stateless) {
    // ---- Stateless mode: fresh server + transport per request ----
    // Used by Cloudflare Workers and proxy-based MCP clients (e.g. Anthropic)
    // that don't maintain session state across requests.
    app.all("/mcp", async (c) => {
      try {
        const transport = new WebStandardStreamableHTTPServerTransport();
        const server = createServer();
        await server.connect(transport);
        return transport.handleRequest(c.req.raw);
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
  } else {
    // ---- Session mode: per-session server instances (for Node.js HTTP) ----
    const sessions: Record<string, {
      server: McpServer;
      transport: WebStandardStreamableHTTPServerTransport;
    }> = {};

    app.post("/mcp", async (c) => {
      const sessionId = c.req.header("mcp-session-id");

      try {
        // Reuse existing session
        if (sessionId && sessions[sessionId]) {
          const { transport } = sessions[sessionId];
          return transport.handleRequest(c.req.raw);
        }

        // New session
        const server = createServer();
        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
        });

        await server.connect(transport);
        const response = await transport.handleRequest(c.req.raw);

        if (transport.sessionId) {
          sessions[transport.sessionId] = { server, transport };
        }

        return response;
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
      return transport.handleRequest(c.req.raw);
    });
  }

  return app;
}
