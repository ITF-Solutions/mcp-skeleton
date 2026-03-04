import { Hono } from "hono";
import { createMcpApp } from "../http/app.js";
import { KvTokenStore } from "../storage/token-store.js";
import { KvCacheStore } from "../storage/cache-store.js";

/**
 * Cloudflare Worker entrypoint
 *
 * This creates a singleton Hono app instance for the Worker runtime.
 * Uses Cloudflare KV for persistent storage across requests.
 */

interface Env {
  SKELETON_KV: KVNamespace;
  ENCRYPTION_KEY: string;
}

let app: Hono | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!app) {
      const tokenStore = new KvTokenStore(env.SKELETON_KV, env.ENCRYPTION_KEY);
      const cacheStore = new KvCacheStore(env.SKELETON_KV);
      app = createMcpApp({ tokenStore, cacheStore });
    }

    return app.fetch(request, env);
  },
};
