/**
 * desktoplens_plugin_remove 工具
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v4';
import { uninstallPlugin } from '../plugin/installer.js';
import type { PluginRegistry } from '../plugin/registry.js';
import type { Logger } from '../utils/logger.js';

export function registerPluginRemove(
  server: McpServer,
  registry: PluginRegistry,
  logger: Logger,
): void {
  server.tool(
    'desktoplens_plugin_remove',
    'Remove an installed DesktopLens plugin',
    {
      plugin_name: z.string().describe('Name of the plugin to remove'),
    },
    async ({ plugin_name }): Promise<CallToolResult> => {
      const success = await uninstallPlugin(plugin_name, registry, logger);

      if (!success) {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Failed to remove plugin "${plugin_name}". It may not be installed.`,
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            removed: true,
            plugin_name,
          }),
        }],
      };
    },
  );
}
