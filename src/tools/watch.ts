import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v4';
import type { WindowDetector } from '../window-manager/detector.js';
import type { SessionManager } from '../stream/session-manager.js';
import type { StreamServer } from '../stream/websocket-server.js';
import type { PlaywrightBridge } from '../browser/playwright-bridge.js';
import type { QualityLevel } from '../stream/encoder.js';

export function registerWatch(
  server: McpServer,
  detector: WindowDetector,
  sessionManager: SessionManager,
  streamServer: StreamServer,
  playwrightBridge: PlaywrightBridge,
): void {
  server.tool(
    'desktoplens_watch',
    'Start real-time streaming of a desktop window via WebSocket',
    {
      window_id: z.number().optional().describe('Window ID to watch'),
      window_title: z.string().optional().describe('Window title to match (fuzzy)'),
      fps: z.number().min(0.5).max(5).optional().describe('Frames per second (0.5-5)'),
      quality: z.enum(['low', 'medium', 'high']).optional().describe('Stream quality level'),
      open_browser: z.boolean().optional().describe('Auto-open Chrome viewer'),
    },
    async ({ window_id, window_title, fps, quality, open_browser }): Promise<CallToolResult> => {
      try {
        // 解析目標視窗
        let windowId: number;
        let windowTitle: string;

        if (window_id !== undefined) {
          const win = await detector.findWindow({ id: window_id });
          windowId = win.id;
          windowTitle = win.title;
        } else if (window_title !== undefined) {
          const win = await detector.findWindow({ title: window_title });
          windowId = win.id;
          windowTitle = win.title;
        } else {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Must provide window_id or window_title' }],
          };
        }

        // 確保串流伺服器已啟動
        if (!streamServer.running) {
          await streamServer.start();
        }

        // 建立 session
        const sessionId = sessionManager.create({
          windowId,
          windowTitle,
          fps: fps ?? 2,
          quality: (quality ?? 'medium') as QualityLevel,
        });

        const streamUrl = `ws://127.0.0.1:${streamServer.port}/stream/${sessionId}`;
        const viewerUrl = `http://127.0.0.1:${streamServer.port}/viewer/${sessionId}`;

        // 自動開啟瀏覽器
        if (open_browser) {
          await playwrightBridge.openViewer(viewerUrl);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                session_id: sessionId,
                stream_url: streamUrl,
                viewer_url: viewerUrl,
                window: { id: windowId, title: windowTitle },
                fps: fps ?? 2,
                quality: quality ?? 'medium',
                status: 'streaming',
              }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            { type: 'text', text: err instanceof Error ? err.message : String(err) },
          ],
        };
      }
    },
  );
}
