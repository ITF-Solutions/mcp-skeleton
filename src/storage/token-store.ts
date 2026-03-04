/**
 * Token Store - Key-value storage abstraction
 *
 * EXTENSION POINT: Add custom storage methods if needed for your use case.
 */

export interface TokenStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

// ============================================================================
// In-Memory Implementation (stdio, http modes)
// ============================================================================

export class InMemoryTokenStore implements TokenStore {
  private store = new Map<string, any>();

  async get<T>(key: string): Promise<T | null> {
    return this.store.get(key) || null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

// ============================================================================
// Cloudflare KV Implementation (worker mode)
// ============================================================================

export class KvTokenStore implements TokenStore {
  constructor(
    private kv: any, // KVNamespace type available in worker context
    private encryptionKey: string
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const encrypted = await this.kv.get(key);
    if (!encrypted) return null;

    // TODO: Implement proper AES-256-GCM decryption
    // For now, just parse as JSON (insecure - for template demonstration only)
    return JSON.parse(encrypted) as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    // TODO: Implement proper AES-256-GCM encryption
    // For now, just stringify (insecure - for template demonstration only)
    const encrypted = JSON.stringify(value);
    await this.kv.put(key, encrypted);
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }

  async clear(): Promise<void> {
    // KV doesn't support bulk delete
    // Implement if needed for your use case
  }
}
