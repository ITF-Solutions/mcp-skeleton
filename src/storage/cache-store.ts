/**
 * Cache Store - TTL-based caching abstraction
 *
 * EXTENSION POINT: Add custom cache methods if needed for your use case.
 */

export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, data: T, ttl: number): Promise<void>;
  invalidate(prefix: string): Promise<void>;
  clear(): Promise<void>;
}

// ============================================================================
// In-Memory Implementation (stdio, http modes)
// ============================================================================

export class InMemoryCacheStore implements CacheStore {
  private cache = new Map<string, { data: any; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    this.cache.set(key, {
      data,
      expiresAt: ttl === Infinity ? Infinity : Date.now() + ttl,
    });
  }

  async invalidate(prefix: string): Promise<void> {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }
}

// ============================================================================
// Cloudflare KV Implementation (worker mode)
// ============================================================================

export class KvCacheStore implements CacheStore {
  private prefix = "mcp-skeleton:cache:";

  constructor(private kv: any) {} // KVNamespace type available in worker context

  async get<T>(key: string): Promise<T | null> {
    const value = await this.kv.get(`${this.prefix}${key}`, "json");
    return value as T | null;
  }

  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    const kvTtl = ttl === Infinity ? undefined : Math.floor(ttl / 1000);
    await this.kv.put(`${this.prefix}${key}`, JSON.stringify(data), {
      expirationTtl: kvTtl,
    });
  }

  async invalidate(prefix: string): Promise<void> {
    // KV doesn't support prefix deletion easily
    // Implement with KV list() if needed for your use case
  }

  async clear(): Promise<void> {
    // KV doesn't support bulk delete
    // Implement with KV list() if needed for your use case
  }
}
