import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createCaptureEngine, type CaptureEngine } from './capture/engine.js';
import { createWindowDetector, type WindowDetector } from './window-manager/detector.js';
import { registerListWindows } from './tools/list-windows.js';
import { registerScreenshot } from './tools/screenshot.js';
import { registerStatus } from './tools/status.js';
import { registerWatch } from './tools/watch.js';
import { registerStop } from './tools/stop.js';
import { registerCompare } from './tools/compare.js';
import { registerPluginSearch } from './tools/plugin-search.js';
import { registerPluginInstall } from './tools/plugin-install.js';
import { registerPluginList } from './tools/plugin-list.js';
import { registerPluginRemove } from './tools/plugin-remove.js';
import { createLogger, type Logger } from './utils/logger.js';
import { loadConfig } from './utils/config.js';
import { createStreamServer, type StreamServer } from './stream/websocket-server.js';
import { createSessionManager, type SessionManager } from './stream/session-manager.js';
import { createPlaywrightBridge, type PlaywrightBridge } from './browser/playwright-bridge.js';
import { createSnapshotStore, type SnapshotStore } from './analysis/snapshot-store.js';
import { createPluginRegistry, type PluginRegistry } from './plugin/registry.js';

export interface ServerDeps {
  engine?: CaptureEngine;
  detector?: WindowDetector;
  logger?: Logger;
  streamServer?: StreamServer;
  sessionManager?: SessionManager;
  playwrightBridge?: PlaywrightBridge;
  snapshotStore?: SnapshotStore;
  pluginRegistry?: PluginRegistry;
}

export interface ServerResult {
  server: McpServer;
  engine: CaptureEngine;
  detector: WindowDetector;
  logger: Logger;
  streamServer: StreamServer;
  sessionManager: SessionManager;
  playwrightBridge: PlaywrightBridge;
  snapshotStore: SnapshotStore;
  pluginRegistry: PluginRegistry;
}

export async function createDesktopLensServer(
  deps?: ServerDeps,
): Promise<ServerResult> {
  const config = loadConfig();
  const logger = deps?.logger ?? createLogger(config.logLevel);
  const engine = deps?.engine ?? (await createCaptureEngine());
  const detector = deps?.detector ?? createWindowDetector(engine);

  const streamServer =
    deps?.streamServer ??
    createStreamServer({ port: config.port, logger });

  const sessionManager =
    deps?.sessionManager ??
    createSessionManager({ engine, streamServer, logger });

  const playwrightBridge =
    deps?.playwrightBridge ??
    (await createPlaywrightBridge(logger));

  const snapshotStore =
    deps?.snapshotStore ?? createSnapshotStore();

  const pluginRegistry =
    deps?.pluginRegistry ?? createPluginRegistry();

  const server = new McpServer({
    name: 'desktoplens',
    version: '0.5.0',
  });

  // Core tools
  registerListWindows(server, detector);
  registerScreenshot(server, engine, detector, snapshotStore);
  registerStatus(server, engine, sessionManager);
  registerWatch(server, detector, sessionManager, streamServer, playwrightBridge);
  registerStop(server, sessionManager);
  registerCompare(server, { engine, detector, snapshotStore });

  // Plugin tools
  registerPluginSearch(server, logger);
  registerPluginInstall(server, pluginRegistry, logger);
  registerPluginList(server, pluginRegistry);
  registerPluginRemove(server, pluginRegistry, logger);

  logger.info('DesktopLens MCP server created', {
    capture_available: engine.available,
    platform: process.platform,
  });

  return { server, engine, detector, logger, streamServer, sessionManager, playwrightBridge, snapshotStore, pluginRegistry };
}
