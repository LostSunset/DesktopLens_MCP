import { describe, it, expect, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createDesktopLensServer } from '../../src/server.js';
import type { CaptureEngine, WindowInfo } from '../../src/capture/engine.js';

// Mock sharp
vi.mock('sharp', () => {
  const pipeline = {
    metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed')),
  };
  return { default: vi.fn(() => pipeline) };
});

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

async function setupClientServer(engine?: CaptureEngine) {
  const { server } = await createDesktopLensServer({
    engine: engine ?? createTestEngine(),
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
  it('lists available tools', async () => {
    const { client } = await setupClientServer();
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name);
    expect(toolNames).toContain('desktoplens_list_windows');
    expect(toolNames).toContain('desktoplens_screenshot');
    expect(toolNames).toContain('desktoplens_status');
    expect(toolNames).toHaveLength(3);
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
    expect(parsed.version).toBe('0.1.0');
    expect(parsed.capture_available).toBe(true);
    expect(parsed.platform).toBeDefined();
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
