import { describe, it, expect, vi } from 'vitest';

// Mock createCaptureEngine to avoid native module dependency
vi.mock('../../src/capture/engine.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../src/capture/engine.js')>();
  return {
    ...orig,
    createCaptureEngine: vi.fn().mockResolvedValue({
      available: true,
      listWindows: vi.fn().mockResolvedValue([]),
      captureWindow: vi.fn(),
      captureByTitle: vi.fn(),
    }),
  };
});

// Mock playwright bridge to avoid native playwright dependency
vi.mock('../../src/browser/playwright-bridge.js', () => ({
  createPlaywrightBridge: vi.fn().mockResolvedValue({
    isAvailable: false,
    openViewer: vi.fn(),
    closeAll: vi.fn(),
  }),
}));

// Mock ws to avoid real server creation
vi.mock('ws', () => ({
  WebSocketServer: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn(),
    handleUpgrade: vi.fn(),
    emit: vi.fn(),
  })),
}));

// Mock node:http
vi.mock('node:http', () => ({
  createServer: vi.fn(() => ({
    listen: vi.fn((_p: number, _h: string, cb: () => void) => cb()),
    close: vi.fn((cb?: (err?: Error) => void) => cb?.()),
    on: vi.fn(),
    address: vi.fn().mockReturnValue({ port: 9876 }),
  })),
}));

import { createDesktopLensServer } from '../../src/server.js';

describe('createDesktopLensServer', () => {
  it('creates server with default deps (no injection)', async () => {
    const result = await createDesktopLensServer();
    expect(result.server).toBeDefined();
    expect(result.engine).toBeDefined();
    expect(result.detector).toBeDefined();
    expect(result.logger).toBeDefined();
    expect(result.streamServer).toBeDefined();
    expect(result.sessionManager).toBeDefined();
    expect(result.playwrightBridge).toBeDefined();
    expect(result.snapshotStore).toBeDefined();
    expect(result.pluginRegistry).toBeDefined();
    expect(result.engine.available).toBe(true);
  });

  it('creates server with partial deps (only logger)', async () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const result = await createDesktopLensServer({ logger });
    expect(result.logger).toBe(logger);
    expect(result.engine).toBeDefined();
    expect(result.detector).toBeDefined();
  });

  it('creates server with partial deps (only engine)', async () => {
    const engine = {
      available: false,
      listWindows: vi.fn().mockResolvedValue([]),
      captureWindow: vi.fn(),
      captureByTitle: vi.fn(),
    };
    const result = await createDesktopLensServer({ engine });
    expect(result.engine).toBe(engine);
    expect(result.detector).toBeDefined();
  });

  it('creates server with injected stream deps', async () => {
    const streamServer = {
      start: vi.fn(),
      stop: vi.fn(),
      broadcast: vi.fn(),
      clientCount: vi.fn().mockReturnValue(0),
      port: 9876,
      running: false,
    };
    const sessionManager = {
      create: vi.fn().mockReturnValue('id'),
      stop: vi.fn().mockReturnValue(true),
      stopAll: vi.fn().mockReturnValue([]),
      list: vi.fn().mockReturnValue([]),
      get: vi.fn(),
      activeCount: 0,
    };
    const playwrightBridge = {
      isAvailable: false,
      openViewer: vi.fn(),
      closeAll: vi.fn(),
    };

    const result = await createDesktopLensServer({ streamServer, sessionManager, playwrightBridge });
    expect(result.streamServer).toBe(streamServer);
    expect(result.sessionManager).toBe(sessionManager);
    expect(result.playwrightBridge).toBe(playwrightBridge);
  });
});
