import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";

import { createMcpApp } from "../http/app.js";
import { handleAccessRequest } from "../auth/access-handler.js";
import { KvTokenStore } from "../storage/token-store.js";
import { KvCacheStore } from "../storage/cache-store.js";
import { registerTools } from "../tools/index.js";

// Type-only import for Workers environment
type KVNamespace = import("@cloudflare/workers-types").KVNamespace;

/**
 * Cloudflare Worker environment bindings
 */
export interface WorkerEnv {
  SKELETON_KV: KVNamespace;
  ENCRYPTION_KEY: string;
  // OAuth (optional — set OAUTH_ENABLED=true to enable)
  OAUTH_ENABLED?: string;
  OAUTH_KV?: KVNamespace;
  ACCESS_CLIENT_ID?: string;
  ACCESS_CLIENT_SECRET?: string;
  ACCESS_TOKEN_URL?: string;
  ACCESS_AUTHORIZATION_URL?: string;
  ACCESS_JWKS_URL?: string;
  COOKIE_ENCRYPTION_KEY?: string;
}

// ============================================================================
// Non-OAuth mode (default) — plain Hono app
// ============================================================================

let honoApp: ReturnType<typeof createMcpApp> | null = null;

function getHonoApp(env: WorkerEnv) {
  if (!honoApp) {
    if (!env.ENCRYPTION_KEY) {
      throw new Error("ENCRYPTION_KEY environment variable is required");
    }

    const tokenStore = new KvTokenStore(env.SKELETON_KV, env.ENCRYPTION_KEY);
    const cacheStore = new KvCacheStore(env.SKELETON_KV);

    honoApp = createMcpApp({ tokenStore, cacheStore, stateless: true });
  }

  return honoApp;
}

/**
 * Non-OAuth fetch handler — used when OAUTH_ENABLED is falsy.
 */
const plainHandler = {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    try {
      return await getHonoApp(env).fetch(request, env);
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          message: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  },
};

// ============================================================================
// OAuth mode — OAuthProvider wraps the MCP handler
// ============================================================================

/**
 * Create a per-request McpServer with tools registered.
 * Used by createMcpHandler when OAuth is enabled.
 */
function createWorkerMcpServer(env: WorkerEnv): McpServer {
  const tokenStore = new KvTokenStore(env.SKELETON_KV, env.ENCRYPTION_KEY);
  const cacheStore = new KvCacheStore(env.SKELETON_KV);

  const server = new McpServer({
    name: "mcp-skeleton",
    version: "1.0.0",
    description: "Template MCP server",
  });

  registerTools(server, { tokenStore, cacheStore });

  return server;
}

/**
 * OAuth-wrapped handler using OAuthProvider + createMcpHandler.
 */
const oauthHandler = new OAuthProvider({
  apiRoute: "/mcp",
  apiHandler: {
    async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
      const server = createWorkerMcpServer(env);
      // Cast needed: agents bundles its own @modelcontextprotocol/sdk version
      return createMcpHandler(server as any)(request, env, ctx);
    },
  },
  defaultHandler: {
    fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
      // OAuthProvider injects OAUTH_PROVIDER into env at runtime
      return handleAccessRequest(request, env as unknown as import("../auth/access-handler.js").AccessHandlerEnv, ctx);
    },
  },
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});

// ============================================================================
// Export — runtime toggle based on OAUTH_ENABLED env var
// ============================================================================

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    if (env.OAUTH_ENABLED === "true") {
      return oauthHandler.fetch(request, env, ctx);
    }

    return plainHandler.fetch(request, env);
  },
};
