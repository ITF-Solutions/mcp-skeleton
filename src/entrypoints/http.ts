import { serve } from "@hono/node-server";
import { createMcpApp } from "../http/app.js";
import { InMemoryTokenStore } from "../storage/token-store.js";
import { InMemoryCacheStore } from "../storage/cache-store.js";
import { loadConfig } from "../config.js";

/**
 * HTTP mode entrypoint - for Node.js
 *
 * This creates an HTTP server that handles MCP SSE connections.
 * Uses in-memory storage (no persistence between restarts).
 * Suitable for local testing and Docker deployment.
 */
export async function startHttpServer(): Promise<void> {
  const config = loadConfig();

  if (!config.http) {
    throw new Error("HTTP config not available. Set MCP_MODE=http");
  }

  const tokenStore = new InMemoryTokenStore();
  const cacheStore = new InMemoryCacheStore();

  const app = createMcpApp({ tokenStore, cacheStore });

  console.log(
    `Starting HTTP server on http://${config.http.host}:${config.http.port}`
  );

  serve({
    fetch: app.fetch,
    port: config.http.port,
    hostname: config.http.host,
  });
}
