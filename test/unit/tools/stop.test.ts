import { describe, it, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerStop } from '../../../src/tools/stop.js';
import type { SessionManager } from '../../../src/stream/session-manager.js';

function createMockSessionManager(): SessionManager {
  return {
    create: vi.fn().mockReturnValue('session-123'),
    stop: vi.fn().mockReturnValue(true),
    stopAll: vi.fn().mockReturnValue(['sess-1', 'sess-2']),
    list: vi.fn().mockReturnValue([]),
    get: vi.fn(),
    activeCount: 0,
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

describe('desktoplens_stop', () => {
  it('stops a specific session', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const sessionMgr = createMockSessionManager();
    registerStop(server, sessionMgr);

    const result = await callTool(server, 'desktoplens_stop', { session_id: 'sess-1' });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.stopped).toEqual(['sess-1']);
    expect(parsed.count).toBe(1);
    expect(sessionMgr.stop).toHaveBeenCalledWith('sess-1');
  });

  it('stops all sessions when no session_id', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const sessionMgr = createMockSessionManager();
    registerStop(server, sessionMgr);

    const result = await callTool(server, 'desktoplens_stop', {});
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.stopped).toEqual(['sess-1', 'sess-2']);
    expect(parsed.count).toBe(2);
    expect(sessionMgr.stopAll).toHaveBeenCalled();
  });

  it('returns error for non-existent session', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const sessionMgr = createMockSessionManager();
    (sessionMgr.stop as ReturnType<typeof vi.fn>).mockReturnValue(false);
    registerStop(server, sessionMgr);

    const result = await callTool(server, 'desktoplens_stop', { session_id: 'nonexistent' });
    expect(result.isError).toBe(true);
    expect((result.content as Array<{ text: string }>)[0]!.text).toContain('Session not found');
  });

  it('returns error on Error throw', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const sessionMgr = createMockSessionManager();
    (sessionMgr.stopAll as ReturnType<typeof vi.fn>).mockImplementation(() => { throw new Error('stop failed'); });
    registerStop(server, sessionMgr);

    const result = await callTool(server, 'desktoplens_stop', {});
    expect(result.isError).toBe(true);
    expect((result.content as Array<{ text: string }>)[0]!.text).toContain('stop failed');
  });

  it('returns error on non-Error throw', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const sessionMgr = createMockSessionManager();
    (sessionMgr.stopAll as ReturnType<typeof vi.fn>).mockImplementation(() => { throw 'string error'; });
    registerStop(server, sessionMgr);

    const result = await callTool(server, 'desktoplens_stop', {});
    expect(result.isError).toBe(true);
    expect((result.content as Array<{ text: string }>)[0]!.text).toContain('string error');
  });
});
