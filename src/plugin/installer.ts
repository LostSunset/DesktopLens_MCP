/**
 * Plugin Installer
 *
 * 從本地路徑或 npm 套件安裝 plugin：
 * 1. 讀取 plugin.json 驗證 manifest
 * 2. 複製到 plugin 目錄
 * 3. 註冊到 registry
 */

import { readFile, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { validateManifest, type PluginManifest } from './manifest.js';
import type { PluginRegistry } from './registry.js';
import type { Logger } from '../utils/logger.js';

export interface InstallResult {
  success: boolean;
  pluginName?: string;
  version?: string;
  error?: string;
}

export function defaultPluginDir(): string {
  return join(homedir(), '.desktoplens', 'plugins');
}

/**
 * 從本地路徑安裝 plugin
 */
export async function installFromLocal(
  sourcePath: string,
  registry: PluginRegistry,
  logger: Logger,
  pluginBaseDir?: string,
): Promise<InstallResult> {
  const baseDir = pluginBaseDir ?? defaultPluginDir();

  try {
    // 讀取 manifest
    const manifestPath = join(sourcePath, 'plugin.json');
    const rawData = await readFile(manifestPath, 'utf-8');
    const data = JSON.parse(rawData) as unknown;

    // 驗證
    const validation = validateManifest(data, registry.names());
    if (!validation.valid || !validation.manifest) {
      return {
        success: false,
        error: `Invalid plugin manifest: ${validation.errors.join('; ')}`,
      };
    }

    const manifest = validation.manifest;
    const destDir = join(baseDir, manifest.name);

    // 複製到 plugin 目錄
    await cp(sourcePath, destDir, { recursive: true });

    // 註冊
    await registry.add({
      manifest,
      installedAt: Date.now(),
      pluginDir: destDir,
      enabled: true,
    });

    logger.info(`Plugin "${manifest.name}" installed`, { version: manifest.version });

    return {
      success: true,
      pluginName: manifest.name,
      version: manifest.version,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('Plugin installation failed', { error: errorMsg });
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * 移除已安裝的 plugin
 */
export async function uninstallPlugin(
  pluginName: string,
  registry: PluginRegistry,
  logger: Logger,
  pluginBaseDir?: string,
): Promise<boolean> {
  const baseDir = pluginBaseDir ?? defaultPluginDir();
  const entry = registry.get(pluginName);

  if (!entry) {
    logger.warn(`Plugin "${pluginName}" not found in registry`);
    return false;
  }

  try {
    // 從磁碟移除
    const pluginDir = join(baseDir, pluginName);
    await rm(pluginDir, { recursive: true, force: true });

    // 從 registry 移除
    await registry.remove(pluginName);

    logger.info(`Plugin "${pluginName}" uninstalled`);
    return true;
  } catch (err) {
    logger.error(`Failed to uninstall plugin "${pluginName}"`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
