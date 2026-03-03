/**
 * Plugin Registry
 *
 * 管理已安裝 plugin 的 JSON 持久化儲存。
 * 預設路徑：~/.desktoplens/plugins/registry.json
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { PluginManifest } from './manifest.js';

export interface RegistryEntry {
  manifest: PluginManifest;
  installedAt: number;
  pluginDir: string;
  enabled: boolean;
}

export interface PluginRegistry {
  /** 取得所有已安裝 plugin */
  list(): RegistryEntry[];
  /** 依名稱取得 plugin */
  get(name: string): RegistryEntry | undefined;
  /** 新增/更新 plugin */
  add(entry: RegistryEntry): Promise<void>;
  /** 移除 plugin */
  remove(name: string): Promise<boolean>;
  /** 已安裝的 plugin 名稱列表 */
  names(): string[];
  /** 持久化到磁碟 */
  save(): Promise<void>;
  /** 從磁碟讀取 */
  load(): Promise<void>;
}

export function defaultRegistryPath(): string {
  return join(homedir(), '.desktoplens', 'plugins', 'registry.json');
}

export function createPluginRegistry(registryPath?: string): PluginRegistry {
  const path = registryPath ?? defaultRegistryPath();
  const entries = new Map<string, RegistryEntry>();

  async function ensureDir(): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
  }

  return {
    list(): RegistryEntry[] {
      return Array.from(entries.values());
    },

    get(name: string): RegistryEntry | undefined {
      return entries.get(name);
    },

    async add(entry: RegistryEntry): Promise<void> {
      entries.set(entry.manifest.name, entry);
      await this.save();
    },

    async remove(name: string): Promise<boolean> {
      const existed = entries.delete(name);
      if (existed) {
        await this.save();
      }
      return existed;
    },

    names(): string[] {
      return Array.from(entries.keys());
    },

    async save(): Promise<void> {
      await ensureDir();
      const data = JSON.stringify(Array.from(entries.values()), null, 2);
      await writeFile(path, data, 'utf-8');
    },

    async load(): Promise<void> {
      try {
        const data = await readFile(path, 'utf-8');
        const arr = JSON.parse(data) as RegistryEntry[];
        entries.clear();
        for (const entry of arr) {
          entries.set(entry.manifest.name, entry);
        }
      } catch {
        // File doesn't exist or is invalid — start with empty registry
        entries.clear();
      }
    },
  };
}
