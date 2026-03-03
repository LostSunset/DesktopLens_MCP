import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock ws
const mockWsClose = vi.fn();
const mockWsOn = vi.fn();
const mockWsSend = vi.fn();
const mockWssClose = vi.fn();
const mockWssOn = vi.fn();
const mockWssHandleUpgrade = vi.fn();
const mockWssEmit = vi.fn();

vi.mock('ws', () => {
  class MockWebSocketServer {
    close = mockWssClose;
    on = mockWssOn;
    handleUpgrade = mockWssHandleUpgrade;
    emit = mockWssEmit;
  }
  return { WebSocketServer: MockWebSocketServer };
});

// Mock node:http
const mockListen = vi.fn();
const mockHttpClose = vi.fn();
const mockHttpOn = vi.fn();
let httpRequestHandler: ((req: unknown, res: unknown) => void) | null = null;

vi.mock('node:http', () => ({
  createServer: vi.fn((handler: (req: unknown, res: unknown) => void) => {
    httpRequestHandler = handler;
    return {
      listen: mockListen,
      close: mockHttpClose,
      on: mockHttpOn,
      address: vi.fn().mockReturnValue({ port: 9876 }),
    };
  }),
}));

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('<html>viewer</html>')),
}));

import { createStreamServer } from '../../../src/stream/websocket-server.js';

function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('websocket-server', () => {
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    httpRequestHandler = null;
    logger = createMockLogger();
    // Default: listen succeeds immediately
    mockListen.mockImplementation((_port: number, _host: string, cb: () => void) => cb());
  });

  describe('createStreamServer', () => {
    it('creates a server with correct initial state', () => {
      const server = createStreamServer({ port: 9876, logger });
      expect(server.running).toBe(false);
      expect(server.port).toBe(9876);
    });
  });

  describe('start', () => {
    it('starts the HTTP and WebSocket servers', async () => {
      const server = createStreamServer({ port: 9876, logger });
      await server.start();
      expect(server.running).toBe(true);
      expect(mockListen).toHaveBeenCalledWith(9876, '127.0.0.1', expect.any(Function));
      expect(logger.info).toHaveBeenCalledWith('Stream server started', { port: 9876 });
    });

    it('is idempotent (calling start twice does nothing)', async () => {
      const server = createStreamServer({ port: 9876, logger });
      await server.start();
      await server.start();
      expect(mockListen).toHaveBeenCalledTimes(1);
    });

    it('rejects if listen fails', async () => {
      mockListen.mockImplementation((_p: number, _h: string, _cb: () => void) => {
        // Don't call callback
      });
      mockHttpOn.mockImplementation((event: string, handler: (err: Error) => void) => {
        if (event === 'error') {
          setTimeout(() => handler(new Error('EADDRINUSE')), 0);
        }
      });

      const server = createStreamServer({ port: 9876, logger });
      await expect(server.start()).rejects.toThrow('EADDRINUSE');
    });
  });

  describe('stop', () => {
    it('stops running server', async () => {
      const server = createStreamServer({ port: 9876, logger });
      await server.start();

      mockWssClose.mockImplementation((cb?: (err?: Error) => void) => {
        cb?.();
      });
      mockHttpClose.mockImplementation((cb?: (err?: Error) => void) => {
        cb?.();
      });

      await server.stop();
      expect(server.running).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('Stream server stopped');
    });

    it('is idempotent (calling stop when not running does nothing)', async () => {
      const server = createStreamServer({ port: 9876, logger });
      await server.stop();
      expect(mockHttpClose).not.toHaveBeenCalled();
    });

    it('closes all WebSocket connections on stop', async () => {
      const server = createStreamServer({ port: 9876, logger });
      await server.start();

      // Add a connected WS client
      const connectionHandler = mockWssOn.mock.calls.find(
        (c: unknown[]) => c[0] === 'connection',
      )?.[1] as (ws: unknown, req: unknown, sessionId: string) => void;

      const wsClose = vi.fn();
      const mockWsClient = {
        readyState: 1,
        OPEN: 1,
        send: vi.fn(),
        on: vi.fn(),
        close: wsClose,
      };
      connectionHandler?.(mockWsClient, {}, 'sess-to-close');
      expect(server.clientCount('sess-to-close')).toBe(1);

      mockWssClose.mockImplementation((cb?: (err?: Error) => void) => { cb?.(); });
      mockHttpClose.mockImplementation((cb?: (err?: Error) => void) => { cb?.(); });

      await server.stop();
      expect(wsClose).toHaveBeenCalled();
    });

    it('rejects if http close fails', async () => {
      const server = createStreamServer({ port: 9876, logger });
      await server.start();

      mockWssClose.mockImplementation((cb?: (err?: Error) => void) => {
        cb?.();
      });
      mockHttpClose.mockImplementation((cb?: (err?: Error) => void) => {
        cb?.(new Error('close error'));
      });

      await expect(server.stop()).rejects.toThrow('close error');
    });

    it('rejects if wss close fails', async () => {
      const server = createStreamServer({ port: 9876, logger });
      await server.start();

      mockWssClose.mockImplementation((cb?: (err?: Error) => void) => {
        cb?.(new Error('wss close error'));
      });
      mockHttpClose.mockImplementation((_cb?: (err?: Error) => void) => {
        // Don't resolve — wss error should reject first
      });

      await expect(server.stop()).rejects.toThrow('wss close error');
    });
  });

  describe('HTTP handler', () => {
    it('serves viewer files', async () => {
      const server = createStreamServer({ port: 9876, logger, viewerDir: '/fake/viewer' });
      await server.start();

      const mockRes = { writeHead: vi.fn(), end: vi.fn() };
      httpRequestHandler?.({ url: '/index.html' }, mockRes);

      // Wait for async readFile
      await vi.waitFor(() => expect(mockRes.end).toHaveBeenCalled());
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' });
    });

    it('serves index.html for root path', async () => {
      const server = createStreamServer({ port: 9876, logger, viewerDir: '/fake/viewer' });
      await server.start();

      const mockRes = { writeHead: vi.fn(), end: vi.fn() };
      httpRequestHandler?.({ url: '/' }, mockRes);

      await vi.waitFor(() => expect(mockRes.end).toHaveBeenCalled());
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' });
    });

    it('serves index.html for viewer session URLs', async () => {
      const server = createStreamServer({ port: 9876, logger, viewerDir: '/fake/viewer' });
      await server.start();

      const mockRes = { writeHead: vi.fn(), end: vi.fn() };
      httpRequestHandler?.({ url: '/viewer/abc-123' }, mockRes);

      await vi.waitFor(() => expect(mockRes.end).toHaveBeenCalled());
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' });
    });

    it('returns 404 for non-existent files', async () => {
      const { readFile } = await import('node:fs/promises');
      (readFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('ENOENT'));

      const server = createStreamServer({ port: 9876, logger, viewerDir: '/fake/viewer' });
      await server.start();

      const mockRes = { writeHead: vi.fn(), end: vi.fn() };
      httpRequestHandler?.({ url: '/nonexistent.txt' }, mockRes);

      await vi.waitFor(() => expect(mockRes.end).toHaveBeenCalledWith('Not Found'));
      expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'text/plain' });
    });

    it('handles null url', async () => {
      const server = createStreamServer({ port: 9876, logger, viewerDir: '/fake/viewer' });
      await server.start();

      const mockRes = { writeHead: vi.fn(), end: vi.fn() };
      httpRequestHandler?.({ url: null }, mockRes);

      await vi.waitFor(() => expect(mockRes.end).toHaveBeenCalled());
    });
  });

  describe('broadcast', () => {
    it('sends data to connected clients', async () => {
      const server = createStreamServer({ port: 9876, logger });
      await server.start();

      // Simulate WebSocket connection via the upgrade handler
      const upgradeHandler = mockHttpOn.mock.calls.find(
        (c: unknown[]) => c[0] === 'upgrade',
      )?.[1] as (req: unknown, socket: unknown, head: unknown) => void;

      // Simulate a client connecting to /stream/test-session
      const connectionHandler = mockWssOn.mock.calls.find(
        (c: unknown[]) => c[0] === 'connection',
      )?.[1] as (ws: unknown, req: unknown, sessionId: string) => void;

      const mockWs = {
        readyState: 1, // OPEN
        OPEN: 1,
        send: mockWsSend,
        on: mockWsOn,
        close: mockWsClose,
      };

      // Simulate connection
      connectionHandler?.(mockWs, {}, 'test-session');

      // Broadcast
      const data = Buffer.from('test-frame');
      server.broadcast('test-session', data);
      expect(mockWsSend).toHaveBeenCalledWith(data);
    });

    it('does nothing for non-existent session', () => {
      const server = createStreamServer({ port: 9876, logger });
      // No error should be thrown
      server.broadcast('nonexistent', Buffer.from('data'));
    });

    it('skips clients that are not OPEN', async () => {
      const server = createStreamServer({ port: 9876, logger });
      await server.start();

      const connectionHandler = mockWssOn.mock.calls.find(
        (c: unknown[]) => c[0] === 'connection',
      )?.[1] as (ws: unknown, req: unknown, sessionId: string) => void;

      const mockWs = {
        readyState: 3, // CLOSED
        OPEN: 1,
        send: mockWsSend,
        on: mockWsOn,
        close: mockWsClose,
      };

      connectionHandler?.(mockWs, {}, 'test-session');
      server.broadcast('test-session', Buffer.from('data'));
      expect(mockWsSend).not.toHaveBeenCalled();
    });
  });

  describe('clientCount', () => {
    it('returns 0 for non-existent session', () => {
      const server = createStreamServer({ port: 9876, logger });
      expect(server.clientCount('nonexistent')).toBe(0);
    });

    it('returns correct count after connections', async () => {
      const server = createStreamServer({ port: 9876, logger });
      await server.start();

      const connectionHandler = mockWssOn.mock.calls.find(
        (c: unknown[]) => c[0] === 'connection',
      )?.[1] as (ws: unknown, req: unknown, sessionId: string) => void;

      const ws1 = { readyState: 1, OPEN: 1, send: vi.fn(), on: vi.fn(), close: vi.fn() };
      const ws2 = { readyState: 1, OPEN: 1, send: vi.fn(), on: vi.fn(), close: vi.fn() };

      connectionHandler?.(ws1, {}, 'sess1');
      connectionHandler?.(ws2, {}, 'sess1');
      expect(server.clientCount('sess1')).toBe(2);
    });
  });

  describe('upgrade handler', () => {
    it('destroys socket for non-stream URLs', async () => {
      const server = createStreamServer({ port: 9876, logger });
      await server.start();

      const upgradeHandler = mockHttpOn.mock.calls.find(
        (c: unknown[]) => c[0] === 'upgrade',
      )?.[1] as (req: unknown, socket: { destroy: () => void }, head: unknown) => void;

      const mockSocket = { destroy: vi.fn() };
      upgradeHandler?.({ url: '/not-a-stream' }, mockSocket, Buffer.alloc(0));
      expect(mockSocket.destroy).toHaveBeenCalled();
    });

    it('handles valid stream URL upgrade', async () => {
      const server = createStreamServer({ port: 9876, logger });
      await server.start();

      const upgradeHandler = mockHttpOn.mock.calls.find(
        (c: unknown[]) => c[0] === 'upgrade',
      )?.[1] as (req: unknown, socket: unknown, head: unknown) => void;

      mockWssHandleUpgrade.mockImplementation(
        (_req: unknown, _socket: unknown, _head: unknown, cb: (ws: unknown) => void) => {
          cb({ on: vi.fn(), close: vi.fn() });
        },
      );

      const mockSocket = { destroy: vi.fn() };
      upgradeHandler?.({ url: '/stream/session-123' }, mockSocket, Buffer.alloc(0));
      expect(mockWssHandleUpgrade).toHaveBeenCalled();
      expect(mockWssEmit).toHaveBeenCalledWith('connection', expect.anything(), expect.anything(), 'session-123');
    });

    it('handles null url in upgrade', async () => {
      const server = createStreamServer({ port: 9876, logger });
      await server.start();

      const upgradeHandler = mockHttpOn.mock.calls.find(
        (c: unknown[]) => c[0] === 'upgrade',
      )?.[1] as (req: unknown, socket: { destroy: () => void }, head: unknown) => void;

      const mockSocket = { destroy: vi.fn() };
      upgradeHandler?.({ url: undefined }, mockSocket, Buffer.alloc(0));
      expect(mockSocket.destroy).toHaveBeenCalled();
    });
  });

  describe('WebSocket close/error', () => {
    it('removes client on close and cleans up empty session', async () => {
      const server = createStreamServer({ port: 9876, logger });
      await server.start();

      const connectionHandler = mockWssOn.mock.calls.find(
        (c: unknown[]) => c[0] === 'connection',
      )?.[1] as (ws: unknown, req: unknown, sessionId: string) => void;

      let closeHandler: (() => void) | undefined;
      const mockWs = {
        readyState: 1,
        OPEN: 1,
        send: vi.fn(),
        on: vi.fn((event: string, handler: () => void) => {
          if (event === 'close') closeHandler = handler;
        }),
        close: vi.fn(),
      };

      connectionHandler?.(mockWs, {}, 'test-sess');
      expect(server.clientCount('test-sess')).toBe(1);

      // Trigger close
      closeHandler?.();
      expect(server.clientCount('test-sess')).toBe(0);
    });

    it('logs warning on WebSocket error', async () => {
      const server = createStreamServer({ port: 9876, logger });
      await server.start();

      const connectionHandler = mockWssOn.mock.calls.find(
        (c: unknown[]) => c[0] === 'connection',
      )?.[1] as (ws: unknown, req: unknown, sessionId: string) => void;

      let errorHandler: ((err: Error) => void) | undefined;
      const mockWs = {
        readyState: 1,
        OPEN: 1,
        send: vi.fn(),
        on: vi.fn((event: string, handler: (err: Error) => void) => {
          if (event === 'error') errorHandler = handler;
        }),
        close: vi.fn(),
      };

      connectionHandler?.(mockWs, {}, 'test-sess');
      errorHandler?.(new Error('ws error'));
      expect(logger.warn).toHaveBeenCalledWith('WebSocket error', {
        sessionId: 'test-sess',
        error: 'ws error',
      });
    });
  });
});
