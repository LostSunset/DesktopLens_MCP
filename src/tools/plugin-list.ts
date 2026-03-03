/**
 * desktoplens_plugin_list 工具
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { PluginRegistry } from '../plugin/registry.js';

export function registerPluginList(
  server: McpServer,
  registry: PluginRegistry,
): void {
  server.tool(
    'desktoplens_plugin_list',
    'List all installed DesktopLens plugins',
    {},
    async (): Promise<CallToolResult> => {
      const entries = registry.list();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            count: entries.length,
            plugins: entries.map(e => ({
              name: e.manifest.name,
              version: e.manifest.version,
              description: e.manifest.description,
              enabled: e.enabled,
              tools: e.manifest.tools.map(t => t.name),
              installed_at: new Date(e.installedAt).toISOString(),
            })),
          }),
        }],
      };
    },
  );
}
