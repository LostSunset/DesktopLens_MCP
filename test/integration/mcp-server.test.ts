import { describe, it, expect, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createDesktopLensServer } from '../../src/server.js';
import type { CaptureEngine, WindowInfo } from '../../src/capture/engine.js';
import type { StreamServer } from '../../src/stream/websocket-server.js';
import type { SessionManager } from '../../src/stream/session-manager.js';
import type { PlaywrightBridge } from '../../src/browser/playwright-bridge.js';
import type { PluginRegistry } from '../../src/plugin/registry.js';

// Mock sharp
vi.mock('sharp', () => {
  const pipeline = {
    metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed')),
    composite: vi.fn().mockReturnThis(),
    ensureAlpha: vi.fn().mockReturnThis(),
    raw: vi.fn().mockReturnThis(),
  };
  return { default: vi.fn(() => pipeline) };
});

// Mock pixelmatch
vi.mock('pixelmatch', () => ({
  default: vi.fn().mockReturnValue(0),
}));

// Mock pngjs
vi.mock('pngjs', () => ({
  PNG: class MockPNG {
    data: Buffer = Buffer.alloc(0);
    constructor(_opts: unknown) {}
    static sync = { write: vi.fn().mockReturnValue(Buffer.from('diff-png')) };
  },
}));

// Mock playwright bridge
vi.mock('../../src/browser/playwright-bridge.js', () => ({
  createPlaywrightBridge: vi.fn().mockResolvedValue({
    isAvailable: false,
    openViewer: vi.fn(),
    closeAll: vi.fn(),
  }),
}));

// Mock marketplace for plugin_search
vi.mock('../../src/plugin/marketplace.js', () => ({
  searchMarketplace: vi.fn().mockResolvedValue({
    total: 0,
    plugins: [],
  }),
}));

// Mock installer for plugin_install/remove
vi.mock('../../src/plugin/installer.js', () => ({
  installFromLocal: vi.fn().mockResolvedValue({
    success: true,
    pluginName: 'test-plugin',
    version: '1.0.0',
  }),
  uninstallPlugin: vi.fn().mockResolvedValue(true),
}));

const testWindow: WindowInfo = {
  id: 42, title: 'Test App', appName: 'test.exe',
  x: 0, y: 0, width: 1024, height: 768, isMinimized: false,
};

function createTestEngine(): CaptureEngine {
  return {
    available: true,
    listWindows: vi.fn().mockResolvedValue([testWindow]),
    captureWindow: vi.fn().mockResolvedValue(Buffer.from('screenshot-data')),
    captureByTitle: vi.fn().mockResolvedValue({
      window: testWindow,
      buffer: Buffer.from('screenshot-data'),
    }),
  };
}

function createTestStreamServer(): StreamServer {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    broadcast: vi.fn(),
    clientCount: vi.fn().mockReturnValue(0),
    port: 9876,
    running: true,
  };
}

function createTestSessionManager(): SessionManager {
  return {
    create: vi.fn().mockReturnValue('test-session-id'),
    stop: vi.fn().mockReturnValue(true),
    stopAll: vi.fn().mockReturnValue(['test-session-id']),
    list: vi.fn().mockReturnValue([]),
    get: vi.fn(),
    activeCount: 0,
  };
}

function createTestBridge(): PlaywrightBridge {
  return {
    isAvailable: false,
    openViewer: vi.fn(),
    closeAll: vi.fn(),
  };
}

function createTestPluginRegistry(): PluginRegistry {
  return {
    list: vi.fn().mockReturnValue([]),
    get: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    names: vi.fn().mockReturnValue([]),
    save: vi.fn(),
    load: vi.fn(),
  };
}

async function setupClientServer(engine?: CaptureEngine) {
  const { server } = await createDesktopLensServer({
    engine: engine ?? createTestEngine(),
    streamServer: createTestStreamServer(),
    sessionManager: createTestSessionManager(),
    playwrightBridge: createTestBridge(),
    pluginRegistry: createTestPluginRegistry(),
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return { client, server };
}

describe('MCP Server Integration', () => {
  it('lists all 10 available tools', async () => {
    const { client } = await setupClientServer();
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual([
      'desktoplens_compare',
      'desktoplens_list_windows',
      'desktoplens_plugin_install',
      'desktoplens_plugin_list',
      'desktoplens_plugin_remove',
      'desktoplens_plugin_search',
      'desktoplens_screenshot',
      'desktoplens_status',
      'desktoplens_stop',
      'desktoplens_watch',
    ]);
    expect(toolNames).toHaveLength(10);
    await client.close();
  });

  it('calls desktoplens_list_windows', async () => {
    const { client } = await setupClientServer();
    const result = await client.callTool({ name: 'desktoplens_list_windows', arguments: {} });
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.count).toBe(1);
    expect(parsed.windows[0].title).toBe('Test App');
    await client.close();
  });

  it('calls desktoplens_list_windows with filter', async () => {
    const { client } = await setupClientServer();
    const result = await client.callTool({
      name: 'desktoplens_list_windows',
      arguments: { filter: 'Test' },
    });
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.count).toBe(1);
    await client.close();
  });

  it('calls desktoplens_screenshot by id', async () => {
    const { client } = await setupClientServer();
    const result = await client.callTool({
      name: 'desktoplens_screenshot',
      arguments: { window_id: 42 },
    });
    expect(result.isError).toBeUndefined();
    const contents = result.content as Array<{ type: string }>;
    expect(contents).toHaveLength(2);
    expect(contents[0]!.type).toBe('text');
    expect(contents[1]!.type).toBe('image');
    await client.close();
  });

  it('calls desktoplens_screenshot by title', async () => {
    const { client } = await setupClientServer();
    const result = await client.callTool({
      name: 'desktoplens_screenshot',
      arguments: { window_title: 'Test' },
    });
    expect(result.isError).toBeUndefined();
    await client.close();
  });

  it('desktoplens_screenshot returns error without id or title', async () => {
    const { client } = await setupClientServer();
    const result = await client.callTool({
      name: 'desktoplens_screenshot',
      arguments: {},
    });
    expect(result.isError).toBe(true);
    await client.close();
  });

  it('calls desktoplens_status', async () => {
    const { client } = await setupClientServer();
    const result = await client.callTool({ name: 'desktoplens_status', arguments: {} });
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.version).toBe('0.5.0');
    expect(parsed.capture_available).toBe(true);
    expect(parsed.platform).toBeDefined();
    expect(parsed.streaming).toBeDefined();
    await client.close();
  });

  it('calls desktoplens_watch', async () => {
    const { client } = await setupClientServer();
    const result = await client.callTool({
      name: 'desktoplens_watch',
      arguments: { window_id: 42 },
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.session_id).toBe('test-session-id');
    expect(parsed.status).toBe('streaming');
    await client.close();
  });

  it('calls desktoplens_stop', async () => {
    const { client } = await setupClientServer();
    const result = await client.callTool({
      name: 'desktoplens_stop',
      arguments: {},
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.stopped).toEqual(['test-session-id']);
    await client.close();
  });

  it('calls desktoplens_compare (returns error without before source)', async () => {
    const { client } = await setupClientServer();
    const result = await client.callTool({
      name: 'desktoplens_compare',
      arguments: { after_window_id: 42 },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0]!.text;
    expect(text).toContain('Must provide before_snapshot_id');
    await client.close();
  });

  it('calls desktoplens_screenshot and saves snapshot', async () => {
    const { client } = await setupClientServer();
    const result = await client.callTool({
      name: 'desktoplens_screenshot',
      arguments: { window_id: 42 },
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.snapshot_id).toBeDefined();
    await client.close();
  });

  it('calls desktoplens_plugin_search', async () => {
    const { client } = await setupClientServer();
    const result = await client.callTool({
      name: 'desktoplens_plugin_search',
      arguments: { query: 'test' },
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.total).toBe(0);
    expect(parsed.plugins).toEqual([]);
    await client.close();
  });

  it('calls desktoplens_plugin_list', async () => {
    const { client } = await setupClientServer();
    const result = await client.callTool({
      name: 'desktoplens_plugin_list',
      arguments: {},
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.count).toBe(0);
    await client.close();
  });

  it('calls desktoplens_plugin_install', async () => {
    const { client } = await setupClientServer();
    const result = await client.callTool({
      name: 'desktoplens_plugin_install',
      arguments: { source: '/fake/path' },
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.installed).toBe(true);
    await client.close();
  });

  it('calls desktoplens_plugin_remove', async () => {
    const { client } = await setupClientServer();
    const result = await client.callTool({
      name: 'desktoplens_plugin_remove',
      arguments: { plugin_name: 'test-plugin' },
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.removed).toBe(true);
    await client.close();
  });

  it('works with stub engine (capture unavailable)', async () => {
    const stubEngine: CaptureEngine = {
      available: false,
      listWindows: vi.fn().mockResolvedValue([]),
      captureWindow: vi.fn().mockRejectedValue(new Error('unavailable')),
      captureByTitle: vi.fn().mockRejectedValue(new Error('unavailable')),
    };
    const { client } = await setupClientServer(stubEngine);

    const statusResult = await client.callTool({ name: 'desktoplens_status', arguments: {} });
    const parsed = JSON.parse((statusResult.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.capture_available).toBe(false);

    const windowsResult = await client.callTool({ name: 'desktoplens_list_windows', arguments: {} });
    const windowsParsed = JSON.parse((windowsResult.content as Array<{ text: string }>)[0]!.text);
    expect(windowsParsed.count).toBe(0);

    await client.close();
  });
});
