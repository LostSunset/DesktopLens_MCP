import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  cp: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:os', () => ({
  homedir: vi.fn().mockReturnValue('/home/testuser'),
}));

import { installFromLocal, uninstallPlugin, defaultPluginDir } from '../../../src/plugin/installer.js';
import { createPluginRegistry } from '../../../src/plugin/registry.js';
import { readFile, cp, rm } from 'node:fs/promises';
import type { PluginRegistry } from '../../../src/plugin/registry.js';

const mockReadFile = vi.mocked(readFile);
const mockCp = vi.mocked(cp);
const mockRm = vi.mocked(rm);

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createMockRegistry(): PluginRegistry {
  const entries = new Map<string, { manifest: { name: string }; installedAt: number; pluginDir: string; enabled: boolean }>();
  return {
    list: vi.fn(() => Array.from(entries.values())) as never,
    get: vi.fn((name: string) => entries.get(name)) as never,
    add: vi.fn(async (entry) => { entries.set(entry.manifest.name, entry); }) as never,
    remove: vi.fn(async (name: string) => entries.delete(name)) as never,
    names: vi.fn(() => Array.from(entries.keys())),
    save: vi.fn(),
    load: vi.fn(),
  };
}

const validManifestJson = JSON.stringify({
  name: 'my-plugin',
  version: '1.0.0',
  description: 'Test plugin',
  main: 'dist/index.js',
  tools: [{ name: 'my_tool', description: 'My tool' }],
});

describe('installer', () => {
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = createMockLogger();
  });

  describe('defaultPluginDir', () => {
    it('returns path under homedir', () => {
      const dir = defaultPluginDir();
      expect(dir).toContain('.desktoplens');
      expect(dir).toContain('plugins');
    });
  });

  describe('installFromLocal', () => {
    it('installs a valid plugin', async () => {
      mockReadFile.mockResolvedValue(validManifestJson as never);
      const registry = createMockRegistry();

      const result = await installFromLocal('/source/path', registry, logger, '/tmp/plugins');

      expect(result.success).toBe(true);
      expect(result.pluginName).toBe('my-plugin');
      expect(result.version).toBe('1.0.0');
      expect(mockCp).toHaveBeenCalledWith('/source/path', expect.stringContaining('my-plugin'), { recursive: true });
      expect(registry.add).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Plugin "my-plugin" installed', { version: '1.0.0' });
    });

    it('returns error for invalid manifest', async () => {
      mockReadFile.mockResolvedValue('{"name": ""}' as never);
      const registry = createMockRegistry();

      const result = await installFromLocal('/source', registry, logger, '/tmp/plugins');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid plugin manifest');
    });

    it('returns error when manifest file cannot be read', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));
      const registry = createMockRegistry();

      const result = await installFromLocal('/missing', registry, logger, '/tmp/plugins');

      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
      expect(logger.error).toHaveBeenCalled();
    });

    it('returns error for non-Error throw', async () => {
      mockReadFile.mockRejectedValue('raw error');
      const registry = createMockRegistry();

      const result = await installFromLocal('/bad', registry, logger, '/tmp/plugins');

      expect(result.success).toBe(false);
      expect(result.error).toBe('raw error');
    });

    it('rejects already installed plugin', async () => {
      mockReadFile.mockResolvedValue(validManifestJson as never);
      const registry = createMockRegistry();
      (registry.names as ReturnType<typeof vi.fn>).mockReturnValue(['my-plugin']);

      const result = await installFromLocal('/source', registry, logger, '/tmp/plugins');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already installed');
    });

    it('uses default plugin dir when not specified', async () => {
      mockReadFile.mockResolvedValue(validManifestJson as never);
      const registry = createMockRegistry();

      await installFromLocal('/source', registry, logger);

      expect(mockCp).toHaveBeenCalledWith(
        '/source',
        expect.stringContaining('.desktoplens'),
        { recursive: true },
      );
    });
  });

  describe('uninstallPlugin', () => {
    it('uninstalls an existing plugin', async () => {
      const registry = createMockRegistry();
      (registry.get as ReturnType<typeof vi.fn>).mockReturnValue({
        manifest: { name: 'my-plugin' },
        pluginDir: '/plugins/my-plugin',
        enabled: true,
      });

      const result = await uninstallPlugin('my-plugin', registry, logger, '/tmp/plugins');

      expect(result).toBe(true);
      expect(mockRm).toHaveBeenCalledWith(expect.stringContaining('my-plugin'), { recursive: true, force: true });
      expect(registry.remove).toHaveBeenCalledWith('my-plugin');
      expect(logger.info).toHaveBeenCalledWith('Plugin "my-plugin" uninstalled');
    });

    it('returns false for non-existent plugin', async () => {
      const registry = createMockRegistry();
      (registry.get as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      const result = await uninstallPlugin('nonexistent', registry, logger, '/tmp/plugins');

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith('Plugin "nonexistent" not found in registry');
    });

    it('handles rm error gracefully', async () => {
      const registry = createMockRegistry();
      (registry.get as ReturnType<typeof vi.fn>).mockReturnValue({
        manifest: { name: 'my-plugin' },
        pluginDir: '/plugins/my-plugin',
      });
      mockRm.mockRejectedValue(new Error('permission denied'));

      const result = await uninstallPlugin('my-plugin', registry, logger, '/tmp/plugins');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('handles non-Error rm failure', async () => {
      const registry = createMockRegistry();
      (registry.get as ReturnType<typeof vi.fn>).mockReturnValue({
        manifest: { name: 'my-plugin' },
        pluginDir: '/plugins/my-plugin',
      });
      mockRm.mockRejectedValue('string error');

      const result = await uninstallPlugin('my-plugin', registry, logger, '/tmp/plugins');

      expect(result).toBe(false);
    });

    it('uses default plugin dir when not specified', async () => {
      mockRm.mockResolvedValue(undefined as never);
      const registry = createMockRegistry();
      (registry.get as ReturnType<typeof vi.fn>).mockReturnValue({
        manifest: { name: 'my-plugin' },
        pluginDir: '/plugins/my-plugin',
        enabled: true,
      });

      const result = await uninstallPlugin('my-plugin', registry, logger);

      expect(result).toBe(true);
      expect(mockRm).toHaveBeenCalledWith(
        expect.stringContaining('.desktoplens'),
        { recursive: true, force: true },
      );
    });
  });
});
