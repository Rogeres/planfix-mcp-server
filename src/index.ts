#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createPlanfixServer } from "./server.js";
import { log } from "./helpers.js";
import { initConfig } from "./config.js";

async function main(): Promise<void> {
  // Load credentials from keychain/env before starting
  await initConfig();

  log("Starting Planfix MCP Server (stdio mode)");

  const server = createPlanfixServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.on("SIGINT", async () => {
    console.log("SIGINT received, shutting down Planfix server...");
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
