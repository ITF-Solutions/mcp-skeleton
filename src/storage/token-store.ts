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
  // CryptoKey type from Web Crypto API — only available in Worker runtime
  private cryptoKey: any = null;

  private static readonly PBKDF2_SALT = "mcp-skeleton-token-encryption-v1";
  private static readonly PBKDF2_ITERATIONS = 100_000;

  constructor(
    private kv: any, // KVNamespace type available in worker context
    private encryptionKey: string
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const stored = await this.kv.get(key);
    if (!stored) return null;

    try {
      // Try decrypting first (encrypted format is "iv:ciphertext")
      const decrypted = await this.decrypt(stored);
      return JSON.parse(decrypted) as T;
    } catch {
      // Fallback: try parsing as plain JSON (migration from unencrypted data)
      try {
        return JSON.parse(stored) as T;
      } catch {
        return null;
      }
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    const json = JSON.stringify(value);
    const encrypted = await this.encrypt(json);
    await this.kv.put(key, encrypted);
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }

  async clear(): Promise<void> {
    // KV doesn't support bulk delete
    // Implement if needed for your use case
  }

  // ============================================================================
  // Encryption Utilities (AES-256-GCM via Web Crypto API)
  // ============================================================================

  private async getCryptoKey(): Promise<any> {
    if (this.cryptoKey) return this.cryptoKey;

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(this.encryptionKey),
      { name: "PBKDF2" },
      false,
      ["deriveKey"],
    );

    this.cryptoKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: encoder.encode(KvTokenStore.PBKDF2_SALT),
        iterations: KvTokenStore.PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );

    return this.cryptoKey;
  }

  private base64urlEncode(bytes: Uint8Array): string {
    const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  private base64urlDecode(input: string): Uint8Array {
    const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private async encrypt(plaintext: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.getCryptoKey();

    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
      key,
      data,
    );

    return `${this.base64urlEncode(iv)}:${this.base64urlEncode(new Uint8Array(ciphertext))}`;
  }

  private async decrypt(encrypted: string): Promise<string> {
    const parts = encrypted.split(":");
    if (parts.length !== 2) {
      throw new Error("Invalid encrypted data format");
    }

    const [ivB64, ciphertextB64] = parts;
    const iv = this.base64urlDecode(ivB64);
    const ciphertext = this.base64urlDecode(ciphertextB64);
    const key = await this.getCryptoKey();

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
      key,
      ciphertext.buffer as ArrayBuffer,
    );

    return new TextDecoder().decode(decrypted);
  }
}
