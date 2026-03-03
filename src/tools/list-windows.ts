import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v4';
import type { WindowDetector } from '../window-manager/detector.js';

export function registerListWindows(server: McpServer, detector: WindowDetector): void {
  server.tool(
    'desktoplens_list_windows',
    'List all visible desktop windows',
    { filter: z.string().optional().describe('Optional title/app name filter keyword') },
    async ({ filter }): Promise<CallToolResult> => {
      try {
        const windows = await detector.listWindows({ filter });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  count: windows.length,
                  windows: windows.map((w) => ({
                    id: w.id,
                    title: w.title,
                    appName: w.appName,
                    bounds: { x: w.x, y: w.y, width: w.width, height: w.height },
                  })),
                },
                null,
                2,
              ),
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
