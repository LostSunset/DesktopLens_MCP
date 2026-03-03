import { describe, it, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerWatch } from '../../../src/tools/watch.js';
import type { WindowDetector } from '../../../src/window-manager/detector.js';
import type { SessionManager } from '../../../src/stream/session-manager.js';
import type { StreamServer } from '../../../src/stream/websocket-server.js';
import type { PlaywrightBridge } from '../../../src/browser/playwright-bridge.js';
import type { WindowInfo } from '../../../src/capture/engine.js';

const mockWindow: WindowInfo = {
  id: 1, title: 'Notepad', appName: 'notepad.exe',
  x: 0, y: 0, width: 800, height: 600, isMinimized: false,
};

function createMockDetector(): WindowDetector {
  return {
    listWindows: vi.fn().mockResolvedValue([mockWindow]),
    findWindow: vi.fn().mockResolvedValue(mockWindow),
  };
}

function createMockSessionManager(): SessionManager {
  return {
    create: vi.fn().mockReturnValue('session-123'),
    stop: vi.fn().mockReturnValue(true),
    stopAll: vi.fn().mockReturnValue([]),
    list: vi.fn().mockReturnValue([]),
    get: vi.fn(),
    activeCount: 0,
  };
}

function createMockStreamServer(): StreamServer {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    broadcast: vi.fn(),
    clientCount: vi.fn().mockReturnValue(0),
    port: 9876,
    running: true,
  };
}

function createMockBridge(): PlaywrightBridge {
  return {
    isAvailable: true,
    openViewer: vi.fn(),
    closeAll: vi.fn(),
  };
}

async function callTool(server: McpServer, name: string, args: Record<string, unknown> = {}) {
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '1.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  const result = await client.callTool({ name, arguments: args });
  await client.close();
  return result;
}

describe('desktoplens_watch', () => {
  it('starts streaming by window_id', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const detector = createMockDetector();
    const sessionMgr = createMockSessionManager();
    const streamServer = createMockStreamServer();
    const bridge = createMockBridge();
    registerWatch(server, detector, sessionMgr, streamServer, bridge);

    const result = await callTool(server, 'desktoplens_watch', { window_id: 1 });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.session_id).toBe('session-123');
    expect(parsed.status).toBe('streaming');
    expect(detector.findWindow).toHaveBeenCalledWith({ id: 1 });
    expect(sessionMgr.create).toHaveBeenCalledWith(expect.objectContaining({
      windowId: 1, windowTitle: 'Notepad',
    }));
  });

  it('starts streaming by window_title', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const detector = createMockDetector();
    const sessionMgr = createMockSessionManager();
    registerWatch(server, detector, sessionMgr, createMockStreamServer(), createMockBridge());

    const result = await callTool(server, 'desktoplens_watch', { window_title: 'Notepad' });
    expect(result.isError).toBeUndefined();
    expect(detector.findWindow).toHaveBeenCalledWith({ title: 'Notepad' });
  });

  it('returns error when neither id nor title provided', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    registerWatch(server, createMockDetector(), createMockSessionManager(), createMockStreamServer(), createMockBridge());

    const result = await callTool(server, 'desktoplens_watch', {});
    expect(result.isError).toBe(true);
    expect((result.content as Array<{ text: string }>)[0]!.text).toContain('Must provide');
  });

  it('starts stream server if not running', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const streamServer = { ...createMockStreamServer(), running: false };
    registerWatch(server, createMockDetector(), createMockSessionManager(), streamServer, createMockBridge());

    await callTool(server, 'desktoplens_watch', { window_id: 1 });
    expect(streamServer.start).toHaveBeenCalled();
  });

  it('opens browser when open_browser is true', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const bridge = createMockBridge();
    registerWatch(server, createMockDetector(), createMockSessionManager(), createMockStreamServer(), bridge);

    await callTool(server, 'desktoplens_watch', { window_id: 1, open_browser: true });
    expect(bridge.openViewer).toHaveBeenCalledWith(expect.stringContaining('http://127.0.0.1:9876/viewer/'));
  });

  it('does not open browser by default', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const bridge = createMockBridge();
    registerWatch(server, createMockDetector(), createMockSessionManager(), createMockStreamServer(), bridge);

    await callTool(server, 'desktoplens_watch', { window_id: 1 });
    expect(bridge.openViewer).not.toHaveBeenCalled();
  });

  it('respects fps and quality parameters', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const sessionMgr = createMockSessionManager();
    registerWatch(server, createMockDetector(), sessionMgr, createMockStreamServer(), createMockBridge());

    await callTool(server, 'desktoplens_watch', { window_id: 1, fps: 4, quality: 'high' });
    expect(sessionMgr.create).toHaveBeenCalledWith(expect.objectContaining({
      fps: 4, quality: 'high',
    }));
  });

  it('includes stream and viewer URLs in response', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    registerWatch(server, createMockDetector(), createMockSessionManager(), createMockStreamServer(), createMockBridge());

    const result = await callTool(server, 'desktoplens_watch', { window_id: 1 });
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.stream_url).toContain('ws://127.0.0.1:9876/stream/');
    expect(parsed.viewer_url).toContain('http://127.0.0.1:9876/viewer/');
  });

  it('returns error when detector throws', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const detector = createMockDetector();
    (detector.findWindow as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('not found'));
    registerWatch(server, detector, createMockSessionManager(), createMockStreamServer(), createMockBridge());

    const result = await callTool(server, 'desktoplens_watch', { window_id: 999 });
    expect(result.isError).toBe(true);
    expect((result.content as Array<{ text: string }>)[0]!.text).toContain('not found');
  });

  it('returns error on non-Error throw', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const detector = createMockDetector();
    (detector.findWindow as ReturnType<typeof vi.fn>).mockRejectedValue('raw error');
    registerWatch(server, detector, createMockSessionManager(), createMockStreamServer(), createMockBridge());

    const result = await callTool(server, 'desktoplens_watch', { window_id: 999 });
    expect(result.isError).toBe(true);
    expect((result.content as Array<{ text: string }>)[0]!.text).toContain('raw error');
  });
});
