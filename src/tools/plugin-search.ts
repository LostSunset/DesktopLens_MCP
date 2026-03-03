/**
 * desktoplens_plugin_search 工具
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v4';
import { searchMarketplace } from '../plugin/marketplace.js';
import type { Logger } from '../utils/logger.js';

export function registerPluginSearch(
  server: McpServer,
  logger: Logger,
): void {
  server.tool(
    'desktoplens_plugin_search',
    'Search for DesktopLens plugins on GitHub marketplace',
    {
      query: z.string().describe('Search query for plugins'),
    },
    async ({ query }): Promise<CallToolResult> => {
      const result = await searchMarketplace(query, logger);

      if (result.error) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Search failed: ${result.error}` }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            total: result.total,
            plugins: result.plugins.map(p => ({
              name: p.name,
              description: p.description,
              author: p.author,
              url: p.url,
              stars: p.stars,
            })),
          }),
        }],
      };
    },
  );
}
