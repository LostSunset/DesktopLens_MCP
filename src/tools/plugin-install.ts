/**
 * desktoplens_plugin_install 工具
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v4';
import { installFromLocal } from '../plugin/installer.js';
import type { PluginRegistry } from '../plugin/registry.js';
import type { Logger } from '../utils/logger.js';

export function registerPluginInstall(
  server: McpServer,
  registry: PluginRegistry,
  logger: Logger,
): void {
  server.tool(
    'desktoplens_plugin_install',
    'Install a DesktopLens plugin from a local path',
    {
      source: z.string().describe('Local path to the plugin directory'),
    },
    async ({ source }): Promise<CallToolResult> => {
      const result = await installFromLocal(source, registry, logger);

      if (!result.success) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Installation failed: ${result.error}` }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            installed: true,
            plugin_name: result.pluginName,
            version: result.version,
          }),
        }],
      };
    },
  );
}
