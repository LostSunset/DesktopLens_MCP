import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createCaptureEngine, type CaptureEngine } from './capture/engine.js';
import { createWindowDetector, type WindowDetector } from './window-manager/detector.js';
import { registerListWindows } from './tools/list-windows.js';
import { registerScreenshot } from './tools/screenshot.js';
import { registerStatus } from './tools/status.js';
import { createLogger, type Logger } from './utils/logger.js';
import { loadConfig } from './utils/config.js';

export interface ServerDeps {
  engine?: CaptureEngine;
  detector?: WindowDetector;
  logger?: Logger;
}

export async function createDesktopLensServer(
  deps?: ServerDeps,
): Promise<{ server: McpServer; engine: CaptureEngine; detector: WindowDetector; logger: Logger }> {
  const config = loadConfig();
  const logger = deps?.logger ?? createLogger(config.logLevel);
  const engine = deps?.engine ?? (await createCaptureEngine());
  const detector = deps?.detector ?? createWindowDetector(engine);

  const server = new McpServer({
    name: 'desktoplens',
    version: '0.1.0',
  });

  registerListWindows(server, detector);
  registerScreenshot(server, engine, detector);
  registerStatus(server, engine);

  logger.info('DesktopLens MCP server created', {
    capture_available: engine.available,
    platform: process.platform,
  });

  return { server, engine, detector, logger };
}
