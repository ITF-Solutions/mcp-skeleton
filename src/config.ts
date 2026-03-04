/**
 * Configuration loader - reads environment variables
 *
 * EXTENSION POINT: Add custom environment variables for your use case.
 */

export type McpMode = "stdio" | "http" | "worker";

export interface SkeletonConfig {
  mode: McpMode;
  http?: {
    port: number;
    host: string;
  };
  storage?: {
    encryptionKey: string;
  };
}

export function loadConfig(): SkeletonConfig {
  const mode = (process.env.MCP_MODE || "stdio") as McpMode;

  const config: SkeletonConfig = { mode };

  if (mode === "http") {
    config.http = {
      port: parseInt(process.env.PORT || "3000", 10),
      host: process.env.HOST || "localhost",
    };
  }

  if (mode === "worker") {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error("ENCRYPTION_KEY is required for worker mode");
    }
    config.storage = { encryptionKey };
  }

  return config;
}
