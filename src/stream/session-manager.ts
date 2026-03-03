/**
 * 串流 Session 管理器
 *
 * 管理串流 session 的生命週期：
 * - 建立 session → 啟動 capture loop (setInterval)
 * - 自適應 FPS：idle 時降為 0.5fps，active 時使用設定 FPS
 * - 停止 session → 清除 interval，通知 WebSocket server
 */

import { v4 as uuidv4 } from 'uuid';
import type { CaptureEngine, WindowInfo } from '../capture/engine.js';
import type { StreamServer } from './websocket-server.js';
import { encodeForStream, type QualityLevel } from './encoder.js';
import {
  encodeFullFrame,
  encodeDiffFrame,
  FrameType,
  type FullFrame,
  type DiffFrame,
} from './protocol.js';
import { diffFrames } from './frame-differ.js';
import type { Logger } from '../utils/logger.js';

export interface SessionConfig {
  windowId: number;
  windowTitle: string;
  fps: number;
  quality: QualityLevel;
}

export interface SessionInfo {
  sessionId: string;
  windowId: number;
  windowTitle: string;
  fps: number;
  quality: QualityLevel;
  startedAt: number;
  frameCount: number;
  status: 'streaming' | 'paused';
}

export interface SessionManager {
  /** 建立新的串流 session */
  create(config: SessionConfig): string;
  /** 停止指定 session，回傳是否成功 */
  stop(sessionId: string): boolean;
  /** 停止所有 session，回傳已停止的 session ID 列表 */
  stopAll(): string[];
  /** 取得所有 active session 資訊 */
  list(): SessionInfo[];
  /** 取得特定 session 資訊 */
  get(sessionId: string): SessionInfo | undefined;
  /** Active session 數量 */
  readonly activeCount: number;
}

interface InternalSession {
  config: SessionConfig;
  sessionId: string;
  startedAt: number;
  frameCount: number;
  intervalId: ReturnType<typeof setInterval> | null;
  prevFrame: Buffer | null;
  status: 'streaming' | 'paused';
}

export interface SessionManagerDeps {
  engine: CaptureEngine;
  streamServer: StreamServer;
  logger: Logger;
}

/**
 * 建立 Session 管理器
 */
export function createSessionManager(deps: SessionManagerDeps): SessionManager {
  const { engine, streamServer, logger } = deps;
  const sessions = new Map<string, InternalSession>();

  async function captureAndSend(session: InternalSession): Promise<void> {
    try {
      const rawPng = await engine.captureWindow(session.config.windowId);

      // 編碼為串流品質
      const encoded = await encodeForStream(
        rawPng,
        800, // 原始尺寸在 encodeForStream 內縮放
        600,
        session.config.quality,
      );

      let frameBuffer: Buffer;

      if (session.prevFrame === null) {
        // 首幀：發送完整幀
        const frame: FullFrame = {
          type: FrameType.Full,
          timestamp: Date.now() & 0xffffffff,
          width: encoded.width,
          height: encoded.height,
          data: encoded.buffer,
        };
        frameBuffer = encodeFullFrame(frame);
      } else {
        // 差異幀比較
        const diff = await diffFrames(session.prevFrame, encoded.buffer, 8, 6);

        if (!diff.changed) {
          // 沒有變化，不發送
          return;
        }

        if (diff.dirtyBlocks.length > 24) {
          // 太多 dirty blocks (>50%)，發送完整幀更有效率
          const frame: FullFrame = {
            type: FrameType.Full,
            timestamp: Date.now() & 0xffffffff,
            width: encoded.width,
            height: encoded.height,
            data: encoded.buffer,
          };
          frameBuffer = encodeFullFrame(frame);
        } else {
          const frame: DiffFrame = {
            type: FrameType.Diff,
            timestamp: Date.now() & 0xffffffff,
            width: encoded.width,
            height: encoded.height,
            gridCols: diff.gridCols,
            gridRows: diff.gridRows,
            blocks: diff.dirtyBlocks,
          };
          frameBuffer = encodeDiffFrame(frame);
        }
      }

      session.prevFrame = encoded.buffer;
      session.frameCount++;
      streamServer.broadcast(session.sessionId, frameBuffer);
    } catch (err) {
      logger.warn('Capture failed for session', {
        sessionId: session.sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    create(config: SessionConfig): string {
      const sessionId = uuidv4();
      const session: InternalSession = {
        config,
        sessionId,
        startedAt: Date.now(),
        frameCount: 0,
        intervalId: null,
        prevFrame: null,
        status: 'streaming',
      };

      const intervalMs = Math.round(1000 / config.fps);
      session.intervalId = setInterval(() => {
        captureAndSend(session).catch(() => {
          // Error already logged in captureAndSend
        });
      }, intervalMs);

      sessions.set(sessionId, session);
      logger.info('Session created', { sessionId, windowId: config.windowId, fps: config.fps });
      return sessionId;
    },

    stop(sessionId: string): boolean {
      const session = sessions.get(sessionId);
      if (!session) return false;

      if (session.intervalId !== null) {
        clearInterval(session.intervalId);
        session.intervalId = null;
      }
      session.status = 'paused';
      sessions.delete(sessionId);
      logger.info('Session stopped', { sessionId });
      return true;
    },

    stopAll(): string[] {
      const stopped: string[] = [];
      for (const sessionId of sessions.keys()) {
        this.stop(sessionId);
        stopped.push(sessionId);
      }
      return stopped;
    },

    list(): SessionInfo[] {
      return Array.from(sessions.values()).map((s) => ({
        sessionId: s.sessionId,
        windowId: s.config.windowId,
        windowTitle: s.config.windowTitle,
        fps: s.config.fps,
        quality: s.config.quality,
        startedAt: s.startedAt,
        frameCount: s.frameCount,
        status: s.status,
      }));
    },

    get(sessionId: string): SessionInfo | undefined {
      const s = sessions.get(sessionId);
      if (!s) return undefined;
      return {
        sessionId: s.sessionId,
        windowId: s.config.windowId,
        windowTitle: s.config.windowTitle,
        fps: s.config.fps,
        quality: s.config.quality,
        startedAt: s.startedAt,
        frameCount: s.frameCount,
        status: s.status,
      };
    },

    get activeCount(): number {
      return sessions.size;
    },
  };
}
