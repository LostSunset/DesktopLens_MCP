#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createDesktopLensServer } from './server.js';

async function main(): Promise<void> {
  const { server, logger } = await createDesktopLensServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('DesktopLens MCP server running on stdio');
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
