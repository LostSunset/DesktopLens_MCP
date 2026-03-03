/**
 * Plugin Loader
 *
 * 動態 import() plugin 模組，建立 PluginContext sandbox，
 * 註冊工具到 MCP server。
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Logger } from '../utils/logger.js';
import type { PluginManifest, PluginTool } from './manifest.js';
import { namespacedToolName } from './manifest.js';

/** Plugin 提供的工具處理函式 */
export type PluginToolHandler = (
  params: Record<string, unknown>,
) => Promise<CallToolResult>;

/** Plugin 模組 export */
export interface PluginModule {
  activate(context: PluginContext): Promise<void> | void;
  deactivate?(): Promise<void> | void;
}

/** Plugin 可用的沙箱 API */
export interface PluginContext {
  /** Plugin 名稱 */
  readonly pluginName: string;
  /** Logger (prefix with plugin name) */
  readonly logger: Logger;
  /** 註冊工具處理函式 */
  registerToolHandler(toolName: string, handler: PluginToolHandler): void;
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  module: PluginModule;
  handlers: Map<string, PluginToolHandler>;
}

/**
 * 載入 plugin 並註冊工具到 MCP server
 */
export async function loadPlugin(
  manifest: PluginManifest,
  pluginDir: string,
  server: McpServer,
  logger: Logger,
): Promise<LoadedPlugin> {
  const entryPoint = `${pluginDir}/${manifest.main}`;
  const handlers = new Map<string, PluginToolHandler>();

  // 建立 sandbox context
  const context: PluginContext = {
    pluginName: manifest.name,
    logger: {
      debug: (msg, data?) => logger.debug(`[plugin:${manifest.name}] ${msg}`, data),
      info: (msg, data?) => logger.info(`[plugin:${manifest.name}] ${msg}`, data),
      warn: (msg, data?) => logger.warn(`[plugin:${manifest.name}] ${msg}`, data),
      error: (msg, data?) => logger.error(`[plugin:${manifest.name}] ${msg}`, data),
    },
    registerToolHandler(toolName: string, handler: PluginToolHandler): void {
      handlers.set(toolName, handler);
    },
  };

  // 動態載入
  const mod = await import(/* webpackIgnore: true */ entryPoint) as PluginModule;

  // 執行 activate
  await mod.activate(context);

  // 註冊工具到 MCP server
  for (const toolDef of manifest.tools) {
    const nsName = namespacedToolName(manifest.name, toolDef.name);
    const handler = handlers.get(toolDef.name);

    if (!handler) {
      logger.warn(`Plugin "${manifest.name}" did not register handler for tool "${toolDef.name}"`);
      continue;
    }

    // 註冊到 MCP server (使用空 schema，plugin 自行驗證)
    server.tool(
      nsName,
      toolDef.description,
      {},
      async (params: Record<string, unknown>): Promise<CallToolResult> => {
        try {
          return await handler(params);
        } catch (err) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Plugin error: ${err instanceof Error ? err.message : String(err)}`,
            }],
          };
        }
      },
    );

    logger.info(`Registered plugin tool: ${nsName}`);
  }

  return { manifest, module: mod, handlers };
}

/**
 * 卸載 plugin (呼叫 deactivate)
 */
export async function unloadPlugin(
  plugin: LoadedPlugin,
  logger: Logger,
): Promise<void> {
  try {
    if (plugin.module.deactivate) {
      await plugin.module.deactivate();
    }
    logger.info(`Plugin "${plugin.manifest.name}" unloaded`);
  } catch (err) {
    logger.error(`Error unloading plugin "${plugin.manifest.name}"`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
