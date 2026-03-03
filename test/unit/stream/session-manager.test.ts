import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('mock-uuid-1234'),
}));

// Mock encoder directly (bypass sharp chain)
vi.mock('../../../src/stream/encoder.js', () => ({
  encodeForStream: vi.fn().mockResolvedValue({
    buffer: Buffer.from('encoded-image'),
    format: 'webp' as const,
    width: 400,
    height: 300,
  }),
  getQualityPreset: vi.fn(),
}));

// Mock frame-differ directly (bypass sharp chain)
vi.mock('../../../src/stream/frame-differ.js', () => ({
  diffFrames: vi.fn().mockResolvedValue({
    changed: false,
    dirtyBlocks: [],
    gridCols: 8,
    gridRows: 6,
  }),
  DEFAULT_GRID_COLS: 8,
  DEFAULT_GRID_ROWS: 6,
}));

// Mock protocol to eliminate binary encoding complexity
vi.mock('../../../src/stream/protocol.js', () => ({
  FrameType: { Full: 0x01, Diff: 0x02 },
  MAGIC: 0xdc01,
  encodeFullFrame: vi.fn().mockReturnValue(Buffer.from('full-frame')),
  encodeDiffFrame: vi.fn().mockReturnValue(Buffer.from('diff-frame')),
  encodeFrame: vi.fn(),
  decodeFrame: vi.fn(),
  ProtocolError: class extends Error { name = 'ProtocolError'; },
}));

import { createSessionManager, type SessionConfig } from '../../../src/stream/session-manager.js';
import type { CaptureEngine } from '../../../src/capture/engine.js';
import type { StreamServer } from '../../../src/stream/websocket-server.js';
import { diffFrames } from '../../../src/stream/frame-differ.js';

const mockDiffFrames = vi.mocked(diffFrames);

function createMockEngine(): CaptureEngine {
  return {
    available: true,
    listWindows: vi.fn().mockResolvedValue([]),
    captureWindow: vi.fn().mockResolvedValue(Buffer.from('raw-png')),
    captureByTitle: vi.fn().mockResolvedValue({ window: {} as never, buffer: Buffer.from('raw-png') }),
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

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const defaultConfig: SessionConfig = {
  windowId: 1,
  windowTitle: 'Test Window',
  fps: 2,
  quality: 'medium',
};

describe('session-manager', () => {
  let engine: CaptureEngine;
  let streamServer: StreamServer;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = createMockEngine();
    streamServer = createMockStreamServer();
    logger = createMockLogger();
  });

  describe('create', () => {
    it('creates a session and returns sessionId', () => {
      const mgr = createSessionManager({ engine, streamServer, logger });
      const sessionId = mgr.create(defaultConfig);
      expect(sessionId).toBe('mock-uuid-1234');
      expect(mgr.activeCount).toBe(1);
      expect(logger.info).toHaveBeenCalledWith('Session created', expect.objectContaining({
        sessionId: 'mock-uuid-1234',
        windowId: 1,
      }));
      mgr.stopAll();
    });

    it('starts capture loop and captures frames', async () => {
      const mgr = createSessionManager({ engine, streamServer, logger });
      mgr.create({ ...defaultConfig, fps: 20 }); // High FPS = quick fire

      await vi.waitFor(() => {
        expect(engine.captureWindow).toHaveBeenCalledWith(1);
      }, { timeout: 1000 });

      mgr.stopAll();
    });

    it('broadcasts first frame to stream server', async () => {
      const mgr = createSessionManager({ engine, streamServer, logger });
      mgr.create({ ...defaultConfig, fps: 20 });

      await vi.waitFor(() => {
        expect(streamServer.broadcast).toHaveBeenCalledWith(
          'mock-uuid-1234',
          expect.any(Buffer),
        );
      }, { timeout: 1000 });

      mgr.stopAll();
    });

    it('skips broadcast when diff shows no changes', async () => {
      // diffFrames returns changed=false (default mock)
      const mgr = createSessionManager({ engine, streamServer, logger });
      mgr.create({ ...defaultConfig, fps: 20 });

      // Wait for captureWindow to be called at least twice
      // (first = full frame, second = diff frame that finds no changes)
      await vi.waitFor(() => {
        expect((engine.captureWindow as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
      }, { timeout: 2000 });

      // Allow async chain to complete
      await new Promise(r => setTimeout(r, 300));

      // Only the first frame should broadcast (prevFrame was null)
      // Second frame: diffFrames returns changed=false → return early, no broadcast
      const broadcastCount = (streamServer.broadcast as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(broadcastCount).toBe(1);
      mgr.stopAll();
    });

    it('sends diff frame when changes detected and dirty blocks are few', async () => {
      mockDiffFrames.mockResolvedValue({
        changed: true,
        dirtyBlocks: [{ col: 0, row: 0, data: Buffer.from('block') }],
        gridCols: 8,
        gridRows: 6,
      });

      const mgr = createSessionManager({ engine, streamServer, logger });
      mgr.create({ ...defaultConfig, fps: 20 });

      await vi.waitFor(() => {
        // At least 2 broadcasts (first full + one diff)
        expect(streamServer.broadcast).toHaveBeenCalledTimes(2);
      }, { timeout: 2000 });

      mgr.stopAll();
    });

    it('sends full frame when too many dirty blocks', async () => {
      // >24 dirty blocks → send full frame instead
      const manyBlocks = Array.from({ length: 25 }, (_, i) => ({
        col: i % 8,
        row: Math.floor(i / 8),
        data: Buffer.from(`block-${i}`),
      }));
      mockDiffFrames.mockResolvedValue({
        changed: true,
        dirtyBlocks: manyBlocks,
        gridCols: 8,
        gridRows: 6,
      });

      const mgr = createSessionManager({ engine, streamServer, logger });
      mgr.create({ ...defaultConfig, fps: 20 });

      await vi.waitFor(() => {
        expect(streamServer.broadcast).toHaveBeenCalledTimes(2);
      }, { timeout: 2000 });

      mgr.stopAll();
    });
  });

  describe('stop', () => {
    it('stops an existing session', () => {
      const mgr = createSessionManager({ engine, streamServer, logger });
      const sessionId = mgr.create(defaultConfig);
      const stopped = mgr.stop(sessionId);
      expect(stopped).toBe(true);
      expect(mgr.activeCount).toBe(0);
      expect(logger.info).toHaveBeenCalledWith('Session stopped', { sessionId });
    });

    it('returns false for non-existent session', () => {
      const mgr = createSessionManager({ engine, streamServer, logger });
      expect(mgr.stop('nonexistent')).toBe(false);
    });

    it('clears the capture interval', async () => {
      const mgr = createSessionManager({ engine, streamServer, logger });
      const sessionId = mgr.create({ ...defaultConfig, fps: 20 });

      // Wait for first capture
      await vi.waitFor(() => {
        expect(engine.captureWindow).toHaveBeenCalled();
      }, { timeout: 1000 });

      mgr.stop(sessionId);
      const callCount = (engine.captureWindow as ReturnType<typeof vi.fn>).mock.calls.length;

      // Wait and verify no more captures
      await new Promise(r => setTimeout(r, 200));
      expect((engine.captureWindow as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount);
    });
  });

  describe('stopAll', () => {
    it('stops all sessions and returns their IDs', async () => {
      const { v4 } = vi.mocked(await import('uuid'));
      v4.mockReturnValueOnce('uuid-1').mockReturnValueOnce('uuid-2');

      const mgr = createSessionManager({ engine, streamServer, logger });
      mgr.create(defaultConfig);
      mgr.create({ ...defaultConfig, windowId: 2 });

      const stopped = mgr.stopAll();
      expect(stopped).toHaveLength(2);
      expect(mgr.activeCount).toBe(0);
    });

    it('returns empty array when no sessions', () => {
      const mgr = createSessionManager({ engine, streamServer, logger });
      expect(mgr.stopAll()).toEqual([]);
    });
  });

  describe('list', () => {
    it('returns all session info', () => {
      const mgr = createSessionManager({ engine, streamServer, logger });
      mgr.create(defaultConfig);

      const list = mgr.list();
      expect(list).toHaveLength(1);
      expect(list[0]!.sessionId).toBe('mock-uuid-1234');
      expect(list[0]!.windowTitle).toBe('Test Window');
      expect(list[0]!.fps).toBe(2);
      expect(list[0]!.quality).toBe('medium');
      expect(list[0]!.status).toBe('streaming');
      expect(list[0]!.frameCount).toBe(0);
      mgr.stopAll();
    });

    it('returns empty array when no sessions', () => {
      const mgr = createSessionManager({ engine, streamServer, logger });
      expect(mgr.list()).toEqual([]);
    });
  });

  describe('get', () => {
    it('returns session info for existing session', () => {
      const mgr = createSessionManager({ engine, streamServer, logger });
      mgr.create(defaultConfig);

      const info = mgr.get('mock-uuid-1234');
      expect(info).toBeDefined();
      expect(info!.sessionId).toBe('mock-uuid-1234');
      mgr.stopAll();
    });

    it('returns undefined for non-existent session', () => {
      const mgr = createSessionManager({ engine, streamServer, logger });
      expect(mgr.get('nonexistent')).toBeUndefined();
    });
  });

  describe('capture error handling', () => {
    it('logs warning when capture fails with Error', async () => {
      (engine.captureWindow as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('capture failed'));
      const mgr = createSessionManager({ engine, streamServer, logger });
      mgr.create({ ...defaultConfig, fps: 20 });

      await vi.waitFor(() => {
        expect(logger.warn).toHaveBeenCalledWith('Capture failed for session', expect.objectContaining({
          error: 'capture failed',
        }));
      }, { timeout: 1000 });

      mgr.stopAll();
    });

    it('logs warning for non-Error capture failure', async () => {
      (engine.captureWindow as ReturnType<typeof vi.fn>).mockRejectedValue('string error');
      const mgr = createSessionManager({ engine, streamServer, logger });
      mgr.create({ ...defaultConfig, fps: 20 });

      await vi.waitFor(() => {
        expect(logger.warn).toHaveBeenCalledWith('Capture failed for session', expect.objectContaining({
          error: 'string error',
        }));
      }, { timeout: 1000 });

      mgr.stopAll();
    });
  });
});
