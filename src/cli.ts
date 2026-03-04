import { startStdioServer } from "./entrypoints/stdio.js";

/**
 * CLI entrypoint - delegates to stdio server.
 * This is the entry point for Claude Desktop.
 */
async function main(): Promise<void> {
  try {
    await startStdioServer();
  } catch (error) {
    const message =
      error instanceof Error ? error.stack ?? error.message : String(error);

    process.stderr.write(`Failed to start mcp-skeleton: ${message}\n`);
    process.exitCode = 1;
  }
}

void main();
