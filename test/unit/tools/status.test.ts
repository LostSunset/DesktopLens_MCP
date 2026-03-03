import { describe, it, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerStatus } from '../../../src/tools/status.js';
import type { CaptureEngine } from '../../../src/capture/engine.js';
import type { SessionManager, SessionInfo } from '../../../src/stream/session-manager.js';

function createMockEngine(available = true): CaptureEngine {
  return {
    available,
    listWindows: vi.fn(),
    captureWindow: vi.fn(),
    captureByTitle: vi.fn(),
  };
}

function createMockSessionManager(sessions: SessionInfo[] = []): SessionManager {
  return {
    create: vi.fn().mockReturnValue('mock-id'),
    stop: vi.fn().mockReturnValue(true),
    stopAll: vi.fn().mockReturnValue([]),
    list: vi.fn().mockReturnValue(sessions),
    get: vi.fn(),
    activeCount: sessions.length,
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
    expect(parsed.version).toBe('0.5.0');
    expect(parsed.capture_available).toBe(true);
    expect(typeof parsed.uptime_seconds).toBe('number');
    expect(parsed.platform).toBeDefined();
    expect(parsed.streaming).toBeDefined();
    expect(parsed.streaming.active_sessions).toEqual([]);
  });

  it('reports unavailable capture engine', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    registerStatus(server, createMockEngine(false));

    const result = await callTool(server, 'desktoplens_status');
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.capture_available).toBe(false);
  });

  it('includes active session info', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    const sessions: SessionInfo[] = [
      {
        sessionId: 'sess-1',
        windowId: 1,
        windowTitle: 'Notepad',
        fps: 2,
        quality: 'medium',
        startedAt: Date.now() - 5000,
        frameCount: 10,
        status: 'streaming',
      },
    ];
    registerStatus(server, createMockEngine(), createMockSessionManager(sessions));

    const result = await callTool(server, 'desktoplens_status');
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.streaming.active_sessions).toHaveLength(1);
    expect(parsed.streaming.active_sessions[0].session_id).toBe('sess-1');
    expect(parsed.streaming.active_sessions[0].window_title).toBe('Notepad');
    expect(parsed.streaming.active_sessions[0].frame_count).toBe(10);
  });

  it('works without sessionManager (backward compat)', async () => {
    const server = new McpServer({ name: 'test', version: '0.1.0' });
    registerStatus(server, createMockEngine());

    const result = await callTool(server, 'desktoplens_status');
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(parsed.streaming.active_sessions).toEqual([]);
  });
});
