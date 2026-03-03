import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v4';
import type { SessionManager } from '../stream/session-manager.js';

export function registerStop(
  server: McpServer,
  sessionManager: SessionManager,
): void {
  server.tool(
    'desktoplens_stop',
    'Stop streaming session(s)',
    {
      session_id: z.string().optional().describe('Session ID to stop (omit to stop all)'),
    },
    async ({ session_id }): Promise<CallToolResult> => {
      try {
        let stopped: string[];

        if (session_id) {
          const success = sessionManager.stop(session_id);
          if (!success) {
            return {
              isError: true,
              content: [{ type: 'text', text: `Session not found: ${session_id}` }],
            };
          }
          stopped = [session_id];
        } else {
          stopped = sessionManager.stopAll();
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ stopped, count: stopped.length }, null, 2),
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
