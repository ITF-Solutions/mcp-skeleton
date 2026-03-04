import { startHttpServer } from "./entrypoints/http.js";

/**
 * HTTP server entrypoint for local testing.
 * Run with: MCP_MODE=http PORT=3000 node dist/http-server.js
 */
async function main(): Promise<void> {
  try {
    await startHttpServer();
  } catch (error) {
    const message =
      error instanceof Error ? error.stack ?? error.message : String(error);

    process.stderr.write(`Failed to start HTTP server: ${message}\n`);
    process.exitCode = 1;
  }
}

void main();
