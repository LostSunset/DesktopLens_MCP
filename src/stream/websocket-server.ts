/**
 * WebSocket + HTTP 共用端口伺服器
 *
 * - HTTP 服務 viewer/ 靜態檔案
 * - WebSocket 提供 /stream/{sessionId} 端點
 * - 僅綁定 localhost
 */

import { createServer, type Server as HttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Logger } from '../utils/logger.js';

/** MIME 類型對應 */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export interface StreamServerOptions {
  port: number;
  logger: Logger;
  /** viewer 靜態檔案目錄 (預設為 <project>/viewer) */
  viewerDir?: string;
}

export interface StreamServer {
  /** 啟動伺服器 */
  start(): Promise<void>;
  /** 停止伺服器 */
  stop(): Promise<void>;
  /** 發送二進制幀到指定 session 的所有客戶端 */
  broadcast(sessionId: string, data: Buffer): void;
  /** 取得指定 session 的連線客戶端數量 */
  clientCount(sessionId: string): number;
  /** 取得伺服器實際埠號 (可能與配置不同) */
  readonly port: number;
  /** 伺服器是否在運行 */
  readonly running: boolean;
}

/**
 * 建立 WebSocket + HTTP 串流伺服器
 */
export function createStreamServer(options: StreamServerOptions): StreamServer {
  const { port, logger } = options;
  const viewerDir = options.viewerDir ?? defaultViewerDir();

  // session → connected WebSocket clients
  const sessions = new Map<string, Set<WebSocket>>();
  let httpServer: HttpServer | null = null;
  let wss: WebSocketServer | null = null;
  let actualPort = port;
  let isRunning = false;

  function handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url ?? '/';
    // Parse out sessionId from /viewer/{sessionId} → serve index.html
    const viewerMatch = url.match(/^\/viewer\/[\w-]+\/?$/);
    const filePath = viewerMatch ? '/index.html' : url === '/' ? '/index.html' : url;

    const ext = extname(filePath);
    const mime = MIME_TYPES[ext] ?? 'application/octet-stream';
    const fullPath = join(viewerDir, filePath);

    readFile(fullPath)
      .then((data) => {
        res.writeHead(200, { 'Content-Type': mime });
        res.end(data);
      })
      .catch(() => {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      });
  }

  function handleUpgrade(req: IncomingMessage, socket: import('node:stream').Duplex, head: Buffer): void {
    const url = req.url ?? '';
    const match = url.match(/^\/stream\/([\w-]+)$/);
    if (!match) {
      socket.destroy();
      return;
    }
    const sessionId = match[1]!;

    wss!.handleUpgrade(req, socket, head, (ws) => {
      wss!.emit('connection', ws, req, sessionId);
    });
  }

  function handleConnection(ws: WebSocket, _req: IncomingMessage, sessionId: string): void {
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, new Set());
    }
    sessions.get(sessionId)!.add(ws);
    logger.debug('WebSocket client connected', { sessionId });

    ws.on('close', () => {
      sessions.get(sessionId)?.delete(ws);
      if (sessions.get(sessionId)?.size === 0) {
        sessions.delete(sessionId);
      }
      logger.debug('WebSocket client disconnected', { sessionId });
    });

    ws.on('error', (err) => {
      logger.warn('WebSocket error', { sessionId, error: err.message });
    });
  }

  return {
    async start(): Promise<void> {
      if (isRunning) return;

      httpServer = createServer(handleHttpRequest);
      wss = new WebSocketServer({ noServer: true });

      httpServer.on('upgrade', handleUpgrade);
      wss.on('connection', handleConnection);

      await new Promise<void>((resolve, reject) => {
        httpServer!.listen(port, '127.0.0.1', () => {
          const addr = httpServer!.address();
          if (addr && typeof addr !== 'string') {
            actualPort = addr.port;
          }
          isRunning = true;
          logger.info('Stream server started', { port: actualPort });
          resolve();
        });
        httpServer!.on('error', reject);
      });
    },

    async stop(): Promise<void> {
      if (!isRunning) return;

      // Close all WebSocket connections
      for (const clients of sessions.values()) {
        for (const ws of clients) {
          ws.close();
        }
      }
      sessions.clear();

      await new Promise<void>((resolve, reject) => {
        wss?.close((err) => {
          if (err) reject(err);
        });
        httpServer?.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      isRunning = false;
      httpServer = null;
      wss = null;
      logger.info('Stream server stopped');
    },

    broadcast(sessionId: string, data: Buffer): void {
      const clients = sessions.get(sessionId);
      if (!clients) return;
      for (const ws of clients) {
        if (ws.readyState === ws.OPEN) {
          ws.send(data);
        }
      }
    },

    clientCount(sessionId: string): number {
      return sessions.get(sessionId)?.size ?? 0;
    },

    get port(): number {
      return actualPort;
    },

    get running(): boolean {
      return isRunning;
    },
  };
}

function defaultViewerDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  // src/stream/websocket-server.ts → project root → viewer/
  return join(thisFile, '..', '..', '..', 'viewer');
}
