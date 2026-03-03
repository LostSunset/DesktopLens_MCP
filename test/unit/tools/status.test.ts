import { describe, it, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerStatus } from '../../../src/tools/status.js';
import type { CaptureEngine } from '../../../src/capture/engine.js';

function createMockEngine(available = true): CaptureEngine {
  return {
    available,
    listWindows: vi.fn(),
    captureWindow: vi.fn(),
    captureByTitle: vi.fn(),
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

describe('desktoplens_status', () => {
  it('returns server status', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    registerStatus(server, createMockEngine());

    const result = await callTool(server, 'desktoplens_status');
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.version).toBe('0.1.0');
    expect(parsed.capture_available).toBe(true);
    expect(typeof parsed.uptime_seconds).toBe('number');
    expect(parsed.platform).toBeDefined();
  });

  it('reports unavailable capture engine', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    registerStatus(server, createMockEngine(false));

    const result = await callTool(server, 'desktoplens_status');
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.capture_available).toBe(false);
  });
});
