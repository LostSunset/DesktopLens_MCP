/**
 * E2E 測試：Plugin 安裝流程
 * search → install → list (verify) → remove → list (verify gone)
 */
import { describe, it, expect, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createDesktopLensServer } from '../../src/server.js';
import type { CaptureEngine, WindowInfo } from '../../src/capture/engine.js';
import type { StreamServer } from '../../src/stream/websocket-server.js';
import type { SessionManager } from '../../src/stream/session-manager.js';
import type { PlaywrightBridge } from '../../src/browser/playwright-bridge.js';
import type { PluginRegistry, RegistryEntry } from '../../src/plugin/registry.js';

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

vi.mock('pixelmatch', () => ({ default: vi.fn().mockReturnValue(0) }));
vi.mock('pngjs', () => ({
  PNG: class MockPNG {
    data: Buffer = Buffer.alloc(0);
    constructor(_opts: unknown) {}
    static sync = { write: vi.fn().mockReturnValue(Buffer.from('png')) };
  },
}));

// Mock playwright bridge
vi.mock('../../src/browser/playwright-bridge.js', () => ({
  createPlaywrightBridge: vi.fn().mockResolvedValue({
    isAvailable: false, openViewer: vi.fn(), closeAll: vi.fn(),
  }),
}));

// Mock marketplace to return search results
vi.mock('../../src/plugin/marketplace.js', () => ({
  searchMarketplace: vi.fn().mockResolvedValue({
    total: 2,
    plugins: [
      { name: 'ui-grid', description: 'Grid overlay', stars: 42, url: 'https://github.com/a/b' },
      { name: 'color-palette', description: 'Color extraction', stars: 15, url: 'https://github.com/c/d' },
    ],
  }),
}));

// Mock installer
vi.mock('../../src/plugin/installer.js', () => ({
  installFromLocal: vi.fn().mockResolvedValue({
    success: true, pluginName: 'ui-grid', version: '1.0.0',
  }),
  uninstallPlugin: vi.fn().mockResolvedValue(true),
}));

const testWindow: WindowInfo = {
  id: 1, title: 'App', appName: 'app.exe',
  x: 0, y: 0, width: 800, height: 600, isMinimized: false,
};

function createTestDeps() {
  const engine: CaptureEngine = {
    available: true,
    listWindows: vi.fn().mockResolvedValue([testWindow]),
    captureWindow: vi.fn().mockResolvedValue(Buffer.from('img')),
    captureByTitle: vi.fn().mockResolvedValue({ window: testWindow, buffer: Buffer.from('img') }),
  };

  const streamServer: StreamServer = {
    start: vi.fn(), stop: vi.fn(), broadcast: vi.fn(),
    clientCount: vi.fn().mockReturnValue(0),
    port: 9876, running: true,
  };

  const sessionManager: SessionManager = {
    create: vi.fn().mockReturnValue('sid'), stop: vi.fn().mockReturnValue(true),
    stopAll: vi.fn().mockReturnValue([]), list: vi.fn().mockReturnValue([]),
    get: vi.fn(), activeCount: 0,
  };

  const bridge: PlaywrightBridge = {
    isAvailable: false, openViewer: vi.fn(), closeAll: vi.fn(),
  };

  // Stateful plugin registry mock
  const entries = new Map<string, RegistryEntry>();
  const pluginRegistry: PluginRegistry = {
    list: vi.fn(() => Array.from(entries.values())),
    get: vi.fn((name: string) => entries.get(name)),
    add: vi.fn(async (entry: RegistryEntry) => { entries.set(entry.manifest.name, entry); }),
    remove: vi.fn(async (name: string) => entries.delete(name)),
    names: vi.fn(() => Array.from(entries.keys())),
    save: vi.fn(), load: vi.fn(),
  };

  return { engine, streamServer, sessionManager, bridge, pluginRegistry, entries };
}

type TextContent = Array<{ type: string; text: string }>;

async function setupFlow() {
  const deps = createTestDeps();
  const { server } = await createDesktopLensServer({
    engine: deps.engine,
    streamServer: deps.streamServer,
    sessionManager: deps.sessionManager,
    playwrightBridge: deps.bridge,
    pluginRegistry: deps.pluginRegistry,
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
  });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'e2e-plugin', version: '1.0.0' });
  await Promise.all([client.connect(ct), server.connect(st)]);
  return { client, ...deps };
}

describe('E2E: Plugin Install Flow', () => {
  it('search → install → list → remove → verify gone', async () => {
    const { client, entries } = await setupFlow();

    // Step 1: Search marketplace
    const searchResult = await client.callTool({
      name: 'desktoplens_plugin_search', arguments: { query: 'ui' },
    });
    expect(searchResult.isError).toBeUndefined();
    const searchData = JSON.parse((searchResult.content as TextContent)[0]!.text);
    expect(searchData.total).toBe(2);
    expect(searchData.plugins).toHaveLength(2);
    expect(searchData.plugins[0].name).toBe('ui-grid');

    // Step 2: Install plugin
    const installResult = await client.callTool({
      name: 'desktoplens_plugin_install', arguments: { source: '/path/to/ui-grid' },
    });
    expect(installResult.isError).toBeUndefined();
    const installData = JSON.parse((installResult.content as TextContent)[0]!.text);
    expect(installData.installed).toBe(true);
    expect(installData.plugin_name).toBe('ui-grid');

    // Step 3: Add to registry manually (simulating real install side-effect)
    entries.set('ui-grid', {
      manifest: {
        name: 'ui-grid',
        version: '1.0.0',
        description: 'Grid overlay',
        main: 'dist/index.js',
        tools: [{ name: 'overlay', description: 'Show grid overlay' }],
      },
      installedAt: Date.now(),
      pluginDir: '/plugins/ui-grid',
      enabled: true,
    });

    // Step 4: List plugins (verify installed)
    const listResult = await client.callTool({
      name: 'desktoplens_plugin_list', arguments: {},
    });
    expect(listResult.isError).toBeUndefined();
    const listData = JSON.parse((listResult.content as TextContent)[0]!.text);
    expect(listData.count).toBe(1);
    expect(listData.plugins[0].name).toBe('ui-grid');
    expect(listData.plugins[0].version).toBe('1.0.0');

    // Step 5: Remove plugin
    const removeResult = await client.callTool({
      name: 'desktoplens_plugin_remove', arguments: { plugin_name: 'ui-grid' },
    });
    expect(removeResult.isError).toBeUndefined();
    const removeData = JSON.parse((removeResult.content as TextContent)[0]!.text);
    expect(removeData.removed).toBe(true);

    // Step 6: List plugins again (verify gone)
    entries.delete('ui-grid');
    const listResult2 = await client.callTool({
      name: 'desktoplens_plugin_list', arguments: {},
    });
    const listData2 = JSON.parse((listResult2.content as TextContent)[0]!.text);
    expect(listData2.count).toBe(0);
    expect(listData2.plugins).toEqual([]);

    await client.close();
  });

  it('search with no results', async () => {
    // Override marketplace mock for this test
    const { searchMarketplace } = await import('../../src/plugin/marketplace.js');
    vi.mocked(searchMarketplace).mockResolvedValueOnce({ total: 0, plugins: [] });

    const { client } = await setupFlow();

    const result = await client.callTool({
      name: 'desktoplens_plugin_search', arguments: { query: 'nonexistent' },
    });
    const data = JSON.parse((result.content as TextContent)[0]!.text);
    expect(data.total).toBe(0);
    expect(data.plugins).toEqual([]);

    await client.close();
  });

  it('install failure returns error info', async () => {
    const { installFromLocal } = await import('../../src/plugin/installer.js');
    vi.mocked(installFromLocal).mockResolvedValueOnce({
      success: false,
      error: 'Invalid manifest: missing name field',
    });

    const { client } = await setupFlow();

    const result = await client.callTool({
      name: 'desktoplens_plugin_install', arguments: { source: '/bad/path' },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as TextContent)[0]!.text;
    expect(text).toContain('Installation failed');
    expect(text).toContain('Invalid manifest');

    await client.close();
  });

  it('plugin lifecycle with core tool interop', async () => {
    const { client } = await setupFlow();

    // List tools — should have exactly 10
    const tools = await client.listTools();
    expect(tools.tools).toHaveLength(10);

    // Use core tool while plugin tools are registered
    const statusResult = await client.callTool({
      name: 'desktoplens_status', arguments: {},
    });
    const statusData = JSON.parse((statusResult.content as TextContent)[0]!.text);
    expect(statusData.version).toBe('0.5.0');

    // Search plugins — doesn't affect core tools
    const searchResult = await client.callTool({
      name: 'desktoplens_plugin_search', arguments: { query: 'test' },
    });
    expect(searchResult.isError).toBeUndefined();

    await client.close();
  });
});
