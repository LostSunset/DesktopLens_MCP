import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CaptureEngine } from '../capture/engine.js';
import { getPlatformInfo } from '../utils/platform.js';

export function registerStatus(server: McpServer, engine: CaptureEngine): void {
  const startTime = Date.now();

  server.tool(
    'desktoplens_status',
    'Get DesktopLens server status and platform info',
    {},
    async (): Promise<CallToolResult> => {
      const platform = getPlatformInfo();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                version: '0.1.0',
                uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
                capture_available: engine.available,
                platform: {
                  os: platform.os,
                  arch: platform.arch,
                  node: platform.nodeVersion,
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
