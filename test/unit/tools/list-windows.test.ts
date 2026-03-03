import { describe, it, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListWindows } from '../../../src/tools/list-windows.js';
import type { WindowDetector } from '../../../src/window-manager/detector.js';
import type { WindowInfo } from '../../../src/capture/engine.js';

const mockWindows: WindowInfo[] = [
  { id: 1, title: 'Notepad', appName: 'notepad.exe', x: 0, y: 0, width: 800, height: 600, isMinimized: false },
];

function createMockDetector(overrides?: Partial<WindowDetector>): WindowDetector {
  return {
    listWindows: vi.fn().mockResolvedValue(mockWindows),
    findWindow: vi.fn(),
    ...overrides,
  };
}

async function callTool(server: McpServer, name: string, args: Record<string, unknown> = {}) {
  // Access registered tool handler through the server internals
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '1.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  const result = await client.callTool({ name, arguments: args });
  await client.close();
  return result;
}

describe('desktoplens_list_windows', () => {
  it('returns window list', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const detector = createMockDetector();
    registerListWindows(server, detector);

    const result = await callTool(server, 'desktoplens_list_windows');
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.count).toBe(1);
    expect(parsed.windows[0].title).toBe('Notepad');
  });

  it('passes filter to detector', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const detector = createMockDetector();
    registerListWindows(server, detector);

    await callTool(server, 'desktoplens_list_windows', { filter: 'note' });
    expect(detector.listWindows).toHaveBeenCalledWith({ filter: 'note' });
  });

  it('returns error when detector throws Error', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const detector = createMockDetector({
      listWindows: vi.fn().mockRejectedValue(new Error('engine failed')),
    });
    registerListWindows(server, detector);

    const result = await callTool(server, 'desktoplens_list_windows');
    expect(result.isError).toBe(true);
    expect((result.content as Array<{ text: string }>)[0]!.text).toContain('engine failed');
  });

  it('returns error when detector throws non-Error', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const detector = createMockDetector({
      listWindows: vi.fn().mockRejectedValue('string error'),
    });
    registerListWindows(server, detector);

    const result = await callTool(server, 'desktoplens_list_windows');
    expect(result.isError).toBe(true);
    expect((result.content as Array<{ text: string }>)[0]!.text).toContain('string error');
  });
});
