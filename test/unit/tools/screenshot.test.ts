import { describe, it, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerScreenshot } from '../../../src/tools/screenshot.js';
import type { CaptureEngine, WindowInfo } from '../../../src/capture/engine.js';
import type { WindowDetector } from '../../../src/window-manager/detector.js';
import { createSnapshotStore } from '../../../src/analysis/snapshot-store.js';

// Mock sharp
vi.mock('sharp', () => {
  const pipeline = {
    metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed-image')),
    composite: vi.fn().mockReturnThis(),
  };
  return { default: vi.fn(() => pipeline) };
});

const mockWindow: WindowInfo = {
  id: 1, title: 'Notepad', appName: 'notepad.exe',
  x: 0, y: 0, width: 800, height: 600, isMinimized: false,
};

function createMockEngine(): CaptureEngine {
  return {
    available: true,
    listWindows: vi.fn().mockResolvedValue([mockWindow]),
    captureWindow: vi.fn().mockResolvedValue(Buffer.from('raw-png')),
    captureByTitle: vi.fn().mockResolvedValue({ window: mockWindow, buffer: Buffer.from('raw-png') }),
  };
}

function createMockDetector(): WindowDetector {
  return {
    listWindows: vi.fn().mockResolvedValue([mockWindow]),
    findWindow: vi.fn().mockResolvedValue(mockWindow),
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

describe('desktoplens_screenshot', () => {
  it('captures by window_id', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const engine = createMockEngine();
    const detector = createMockDetector();
    registerScreenshot(server, engine, detector);

    const result = await callTool(server, 'desktoplens_screenshot', { window_id: 1 });
    expect(result.isError).toBeUndefined();
    expect(detector.findWindow).toHaveBeenCalledWith({ id: 1 });
    expect(engine.captureWindow).toHaveBeenCalledWith(1);
  });

  it('captures by window_title', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const engine = createMockEngine();
    const detector = createMockDetector();
    registerScreenshot(server, engine, detector);

    const result = await callTool(server, 'desktoplens_screenshot', { window_title: 'Notepad' });
    expect(result.isError).toBeUndefined();
    expect(engine.captureByTitle).toHaveBeenCalledWith('Notepad');
  });

  it('returns error when neither id nor title provided', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    registerScreenshot(server, createMockEngine(), createMockDetector());

    const result = await callTool(server, 'desktoplens_screenshot', {});
    expect(result.isError).toBe(true);
    expect((result.content as Array<{ text: string }>)[0]!.text).toContain('Must provide');
  });

  it('returns image content', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    registerScreenshot(server, createMockEngine(), createMockDetector());

    const result = await callTool(server, 'desktoplens_screenshot', { window_id: 1 });
    const contents = result.content as Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
    expect(contents).toHaveLength(2);
    expect(contents[0]!.type).toBe('text');
    expect(contents[1]!.type).toBe('image');
    expect(contents[1]!.mimeType).toBe('image/png');
  });

  it('returns error when capture fails with Error', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const engine = createMockEngine();
    (engine.captureWindow as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('capture error'));
    registerScreenshot(server, engine, createMockDetector());

    const result = await callTool(server, 'desktoplens_screenshot', { window_id: 1 });
    expect(result.isError).toBe(true);
    expect((result.content as Array<{ text: string }>)[0]!.text).toContain('capture error');
  });

  it('returns error when capture fails with non-Error', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const engine = createMockEngine();
    (engine.captureWindow as ReturnType<typeof vi.fn>).mockRejectedValue('raw failure');
    registerScreenshot(server, engine, createMockDetector());

    const result = await callTool(server, 'desktoplens_screenshot', { window_id: 1 });
    expect(result.isError).toBe(true);
    expect((result.content as Array<{ text: string }>)[0]!.text).toContain('raw failure');
  });

  it('respects jpeg format and mimeType', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    registerScreenshot(server, createMockEngine(), createMockDetector());

    const result = await callTool(server, 'desktoplens_screenshot', {
      window_id: 1,
      format: 'jpeg',
    });
    const contents = result.content as Array<{ type: string; mimeType?: string }>;
    // processImage mock returns 'jpeg' format since we passed it
    expect(contents[1]!.mimeType).toBe('image/jpeg');
  });

  it('accepts max_width and max_height parameters', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    registerScreenshot(server, createMockEngine(), createMockDetector());

    const result = await callTool(server, 'desktoplens_screenshot', {
      window_id: 1,
      max_width: 640,
      max_height: 480,
    });
    expect(result.isError).toBeUndefined();
  });

  it('saves snapshot when snapshotStore is provided', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const store = createSnapshotStore(10);
    registerScreenshot(server, createMockEngine(), createMockDetector(), store);

    const result = await callTool(server, 'desktoplens_screenshot', { window_id: 1 });
    expect(result.isError).toBeUndefined();

    const contents = result.content as Array<{ type: string; text?: string }>;
    const metadata = JSON.parse(contents[0]!.text!);
    expect(metadata.snapshot_id).toBe('snap-1');
    expect(store.size).toBe(1);
  });

  it('does not include snapshot_id when no store provided', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    registerScreenshot(server, createMockEngine(), createMockDetector());

    const result = await callTool(server, 'desktoplens_screenshot', { window_id: 1 });
    const contents = result.content as Array<{ type: string; text?: string }>;
    const metadata = JSON.parse(contents[0]!.text!);
    expect(metadata.snapshot_id).toBeUndefined();
  });

  it('applies annotation overlay when annotate is true', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    registerScreenshot(server, createMockEngine(), createMockDetector());

    const result = await callTool(server, 'desktoplens_screenshot', {
      window_id: 1,
      annotate: true,
    });
    expect(result.isError).toBeUndefined();
  });
});
