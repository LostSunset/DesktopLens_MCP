/**
 * E2E 測試：完整擷取流程
 * list → screenshot (auto snapshot) → watch → compare → stop
 */
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
    toBuffer: vi.fn().mockImplementation((opts?: { resolveWithObject?: boolean }) => {
      if (opts?.resolveWithObject) {
        const data = Buffer.alloc(800 * 600 * 4, 128);
        return Promise.resolve({ data, info: { width: 800, height: 600, channels: 4 } });
      }
      return Promise.resolve(Buffer.from('processed'));
    }),
    composite: vi.fn().mockReturnThis(),
    ensureAlpha: vi.fn().mockReturnThis(),
    raw: vi.fn().mockReturnThis(),
  };
  return { default: vi.fn(() => pipeline) };
});

// Mock pixelmatch
vi.mock('pixelmatch', () => ({
  default: vi.fn().mockReturnValue(100),
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

vi.mock('../../src/plugin/marketplace.js', () => ({
  searchMarketplace: vi.fn().mockResolvedValue({ total: 0, plugins: [] }),
}));

vi.mock('../../src/plugin/installer.js', () => ({
  installFromLocal: vi.fn().mockResolvedValue({ success: true, pluginName: 'p', version: '1.0.0' }),
  uninstallPlugin: vi.fn().mockResolvedValue(true),
}));

const windows: WindowInfo[] = [
  { id: 1, title: 'Notepad', appName: 'notepad.exe', x: 0, y: 0, width: 800, height: 600, isMinimized: false },
  { id: 2, title: 'Calculator', appName: 'calc.exe', x: 100, y: 100, width: 400, height: 500, isMinimized: false },
];

let captureCount = 0;
function createEngine(): CaptureEngine {
  captureCount = 0;
  return {
    available: true,
    listWindows: vi.fn().mockResolvedValue(windows),
    captureWindow: vi.fn().mockImplementation(() => {
      captureCount++;
      return Promise.resolve(Buffer.from(`capture-${captureCount}`));
    }),
    captureByTitle: vi.fn().mockImplementation((title: string) => {
      captureCount++;
      const win = windows.find((w) => w.title.includes(title)) ?? windows[0]!;
      return Promise.resolve({ window: win, buffer: Buffer.from(`capture-${captureCount}`) });
    }),
  };
}

function createStreamServer(): StreamServer {
  return {
    start: vi.fn(), stop: vi.fn(), broadcast: vi.fn(),
    clientCount: vi.fn().mockReturnValue(0),
    port: 9876, running: true,
  };
}

function createSessionManager(): SessionManager {
  const sessions = new Map<string, { sessionId: string; windowTitle: string }>();
  let counter = 0;
  return {
    create: vi.fn().mockImplementation(() => {
      const id = `sess-${++counter}`;
      sessions.set(id, { sessionId: id, windowTitle: 'Notepad' });
      return id;
    }),
    stop: vi.fn().mockImplementation((id: string) => {
      const existed = sessions.has(id);
      sessions.delete(id);
      return existed;
    }),
    stopAll: vi.fn().mockImplementation(() => {
      const ids = Array.from(sessions.keys());
      sessions.clear();
      return ids;
    }),
    list: vi.fn().mockReturnValue([]),
    get: vi.fn(),
    activeCount: 0,
  };
}

function createBridge(): PlaywrightBridge {
  return { isAvailable: false, openViewer: vi.fn(), closeAll: vi.fn() };
}

function createPluginReg(): PluginRegistry {
  return {
    list: vi.fn().mockReturnValue([]),
    get: vi.fn(), add: vi.fn(), remove: vi.fn(),
    names: vi.fn().mockReturnValue([]),
    save: vi.fn(), load: vi.fn(),
  };
}

async function setupFlow() {
  const engine = createEngine();
  const sessionMgr = createSessionManager();
  const { server } = await createDesktopLensServer({
    engine,
    streamServer: createStreamServer(),
    sessionManager: sessionMgr,
    playwrightBridge: createBridge(),
    pluginRegistry: createPluginReg(),
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
  });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'e2e-test', version: '1.0.0' });
  await Promise.all([client.connect(ct), server.connect(st)]);
  return { client, engine, sessionMgr };
}

type TextContent = Array<{ type: string; text: string }>;

describe('E2E: Full Capture Flow', () => {
  it('list → screenshot → watch → stop (complete workflow)', async () => {
    const { client } = await setupFlow();

    // Step 1: List windows
    const listResult = await client.callTool({ name: 'desktoplens_list_windows', arguments: {} });
    const listData = JSON.parse((listResult.content as TextContent)[0]!.text);
    expect(listData.count).toBe(2);
    expect(listData.windows.map((w: { title: string }) => w.title)).toEqual(['Notepad', 'Calculator']);

    // Step 2: Screenshot first window (creates snapshot)
    const ssResult = await client.callTool({
      name: 'desktoplens_screenshot', arguments: { window_id: 1 },
    });
    expect(ssResult.isError).toBeUndefined();
    const ssData = JSON.parse((ssResult.content as TextContent)[0]!.text);
    expect(ssData.snapshot_id).toBeDefined();
    const snapshotId = ssData.snapshot_id;

    // Step 3: Watch (start streaming)
    const watchResult = await client.callTool({
      name: 'desktoplens_watch', arguments: { window_id: 1 },
    });
    expect(watchResult.isError).toBeUndefined();
    const watchData = JSON.parse((watchResult.content as TextContent)[0]!.text);
    expect(watchData.session_id).toBe('sess-1');
    expect(watchData.status).toBe('streaming');

    // Step 4: Check status
    const statusResult = await client.callTool({ name: 'desktoplens_status', arguments: {} });
    const statusData = JSON.parse((statusResult.content as TextContent)[0]!.text);
    expect(statusData.capture_available).toBe(true);
    expect(statusData.version).toBe('0.5.0');

    // Step 5: Compare with snapshot (before=snapshot, after=live window)
    const compareResult = await client.callTool({
      name: 'desktoplens_compare',
      arguments: { before_snapshot_id: snapshotId, after_window_id: 1 },
    });
    expect(compareResult.isError).toBeUndefined();
    const compareData = JSON.parse((compareResult.content as TextContent)[0]!.text);
    expect(compareData.similarity_score).toBeDefined();
    expect(typeof compareData.similarity_score).toBe('number');

    // Step 6: Stop all sessions
    const stopResult = await client.callTool({ name: 'desktoplens_stop', arguments: {} });
    expect(stopResult.isError).toBeUndefined();
    const stopData = JSON.parse((stopResult.content as TextContent)[0]!.text);
    expect(stopData.stopped).toEqual(['sess-1']);

    await client.close();
  });

  it('screenshot by title → filter windows → screenshot another', async () => {
    const { client } = await setupFlow();

    // Screenshot by title
    const ss1 = await client.callTool({
      name: 'desktoplens_screenshot', arguments: { window_title: 'Notepad' },
    });
    expect(ss1.isError).toBeUndefined();

    // Filter windows
    const filtered = await client.callTool({
      name: 'desktoplens_list_windows', arguments: { filter: 'Calc' },
    });
    const filteredData = JSON.parse((filtered.content as TextContent)[0]!.text);
    expect(filteredData.count).toBe(1);
    expect(filteredData.windows[0].title).toBe('Calculator');

    // Screenshot by ID
    const ss2 = await client.callTool({
      name: 'desktoplens_screenshot', arguments: { window_id: 2 },
    });
    expect(ss2.isError).toBeUndefined();

    await client.close();
  });

  it('error handling: screenshot without id/title → compare without before', async () => {
    const { client } = await setupFlow();

    // No window specified
    const ssErr = await client.callTool({
      name: 'desktoplens_screenshot', arguments: {},
    });
    expect(ssErr.isError).toBe(true);

    // Compare without before source
    const cmpErr = await client.callTool({
      name: 'desktoplens_compare', arguments: { after_window_id: 1 },
    });
    expect(cmpErr.isError).toBe(true);
    const errText = (cmpErr.content as TextContent)[0]!.text;
    expect(errText).toContain('Must provide before_snapshot_id');

    await client.close();
  });

  it('multiple watch sessions then stop all', async () => {
    const { client } = await setupFlow();

    // Start two watch sessions
    const w1 = await client.callTool({ name: 'desktoplens_watch', arguments: { window_id: 1 } });
    const w1Data = JSON.parse((w1.content as TextContent)[0]!.text);
    expect(w1Data.session_id).toBe('sess-1');

    const w2 = await client.callTool({ name: 'desktoplens_watch', arguments: { window_id: 2 } });
    const w2Data = JSON.parse((w2.content as TextContent)[0]!.text);
    expect(w2Data.session_id).toBe('sess-2');

    // Stop all
    const stop = await client.callTool({ name: 'desktoplens_stop', arguments: {} });
    const stopData = JSON.parse((stop.content as TextContent)[0]!.text);
    expect(stopData.stopped).toEqual(['sess-1', 'sess-2']);

    await client.close();
  });
});
