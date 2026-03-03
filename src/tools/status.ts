import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CaptureEngine } from '../capture/engine.js';
import type { SessionManager } from '../stream/session-manager.js';
import { getPlatformInfo } from '../utils/platform.js';

export function registerStatus(
  server: McpServer,
  engine: CaptureEngine,
  sessionManager?: SessionManager,
): void {
  const startTime = Date.now();

  server.tool(
    'desktoplens_status',
    'Get DesktopLens server status and platform info',
    {},
    async (): Promise<CallToolResult> => {
      const platform = getPlatformInfo();
      const sessions = sessionManager?.list() ?? [];

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                version: '0.5.0',
                uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
                capture_available: engine.available,
                platform: {
                  os: platform.os,
                  arch: platform.arch,
                  node: platform.nodeVersion,
                },
                streaming: {
                  active_sessions: sessions.map((s) => ({
                    session_id: s.sessionId,
                    window_title: s.windowTitle,
                    fps: s.fps,
                    quality: s.quality,
                    uptime_seconds: Math.floor((Date.now() - s.startedAt) / 1000),
                    frame_count: s.frameCount,
                    status: s.status,
                  })),
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
