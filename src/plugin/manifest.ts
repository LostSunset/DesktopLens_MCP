/**
 * Plugin Manifest 驗證
 *
 * 使用 Zod schema 驗證 plugin.json，
 * 檢查工具名稱衝突。
 */

import { z } from 'zod/v4';

/** Plugin 工具定義 schema */
export const PluginToolSchema = z.object({
  name: z.string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*$/, 'Tool name must be lowercase alphanumeric with underscores'),
  description: z.string().min(1),
  inputSchema: z.record(z.string(), z.any()).optional(),
});

/** Plugin manifest schema */
export const PluginManifestSchema = z.object({
  name: z.string()
    .min(1)
    .regex(/^[a-z][a-z0-9-]*$/, 'Plugin name must be lowercase alphanumeric with hyphens'),
  version: z.string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must be semver (x.y.z)'),
  description: z.string().min(1),
  author: z.string().optional(),
  license: z.string().optional(),
  main: z.string().min(1).describe('Entry point (relative path to JS module)'),
  tools: z.array(PluginToolSchema).min(1, 'Plugin must define at least one tool'),
  dependencies: z.record(z.string(), z.string()).optional(),
  desktoplensVersion: z.string().optional().describe('Compatible DesktopLens version range'),
});

export type PluginTool = z.infer<typeof PluginToolSchema>;
export type PluginManifest = z.infer<typeof PluginManifestSchema>;

/** 核心工具名稱 (保留，Plugin 不可使用) */
const RESERVED_TOOL_NAMES = new Set([
  'list_windows',
  'screenshot',
  'status',
  'watch',
  'stop',
  'compare',
  'plugin_search',
  'plugin_install',
  'plugin_list',
  'plugin_remove',
]);

export interface ValidationResult {
  valid: boolean;
  manifest?: PluginManifest;
  errors: string[];
}

/**
 * 驗證 plugin manifest
 *
 * @param data 原始 JSON 資料
 * @param existingPlugins 已安裝的 plugin 名稱 (用於檢查衝突)
 */
export function validateManifest(
  data: unknown,
  existingPlugins: string[] = [],
): ValidationResult {
  const result = PluginManifestSchema.safeParse(data);

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      ),
    };
  }

  const manifest = result.data;
  const errors: string[] = [];

  // 檢查 plugin 名稱衝突
  if (existingPlugins.includes(manifest.name)) {
    errors.push(`Plugin "${manifest.name}" is already installed`);
  }

  // 檢查工具名稱保留字衝突
  for (const tool of manifest.tools) {
    if (RESERVED_TOOL_NAMES.has(tool.name)) {
      errors.push(`Tool name "${tool.name}" is reserved by core DesktopLens`);
    }
  }

  // 檢查工具名稱在 plugin 內部重複
  const toolNames = manifest.tools.map((t) => t.name);
  const duplicates = toolNames.filter((n, i) => toolNames.indexOf(n) !== i);
  if (duplicates.length > 0) {
    errors.push(`Duplicate tool names: ${[...new Set(duplicates)].join(', ')}`);
  }

  if (errors.length > 0) {
    return { valid: false, manifest, errors };
  }

  return { valid: true, manifest, errors: [] };
}

/**
 * 產生帶 namespace 的工具名稱
 *
 * @param pluginName Plugin 名稱
 * @param toolName 工具名稱
 * @returns 前綴後的名稱 e.g. "plugin_my-plugin_my_tool"
 */
export function namespacedToolName(pluginName: string, toolName: string): string {
  return `plugin_${pluginName}_${toolName}`;
}
