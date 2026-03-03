import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Mock node:os
vi.mock('node:os', () => ({
  homedir: vi.fn().mockReturnValue('/home/testuser'),
}));

import { createPluginRegistry, defaultRegistryPath, type RegistryEntry } from '../../../src/plugin/registry.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import type { PluginManifest } from '../../../src/plugin/manifest.js';

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);

function createTestEntry(name: string): RegistryEntry {
  return {
    manifest: {
      name,
      version: '1.0.0',
      description: `Plugin ${name}`,
      main: 'dist/index.js',
      tools: [{ name: 'test_tool', description: 'Test' }],
    },
    installedAt: Date.now(),
    pluginDir: `/plugins/${name}`,
    enabled: true,
  };
}

describe('registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
  });

  describe('defaultRegistryPath', () => {
    it('returns path under homedir', () => {
      const path = defaultRegistryPath();
      expect(path).toContain('.desktoplens');
      expect(path).toContain('registry.json');
    });
  });

  describe('createPluginRegistry', () => {
    it('starts with empty registry', () => {
      const reg = createPluginRegistry('/tmp/test-registry.json');
      expect(reg.list()).toEqual([]);
      expect(reg.names()).toEqual([]);
    });

    it('adds an entry and persists', async () => {
      const reg = createPluginRegistry('/tmp/test-registry.json');
      const entry = createTestEntry('my-plugin');

      await reg.add(entry);

      expect(reg.list()).toHaveLength(1);
      expect(reg.get('my-plugin')).toBe(entry);
      expect(reg.names()).toEqual(['my-plugin']);
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('removes an entry and persists', async () => {
      const reg = createPluginRegistry('/tmp/test-registry.json');
      await reg.add(createTestEntry('to-remove'));

      const removed = await reg.remove('to-remove');
      expect(removed).toBe(true);
      expect(reg.list()).toHaveLength(0);
      expect(mockWriteFile).toHaveBeenCalledTimes(2); // add + remove
    });

    it('returns false when removing non-existent entry', async () => {
      const reg = createPluginRegistry('/tmp/test-registry.json');
      const removed = await reg.remove('nonexistent');
      expect(removed).toBe(false);
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('loads from disk', async () => {
      const entries = [createTestEntry('loaded-plugin')];
      mockReadFile.mockResolvedValue(JSON.stringify(entries) as never);

      const reg = createPluginRegistry('/tmp/test-registry.json');
      await reg.load();

      expect(reg.list()).toHaveLength(1);
      expect(reg.get('loaded-plugin')).toBeDefined();
    });

    it('handles missing registry file on load', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const reg = createPluginRegistry('/tmp/test-registry.json');
      await reg.load();

      expect(reg.list()).toEqual([]);
    });

    it('handles corrupted registry file on load', async () => {
      mockReadFile.mockResolvedValue('not valid json {{{' as never);

      const reg = createPluginRegistry('/tmp/test-registry.json');
      await reg.load();

      expect(reg.list()).toEqual([]);
    });

    it('saves JSON with formatting', async () => {
      const reg = createPluginRegistry('/tmp/test-registry.json');
      await reg.add(createTestEntry('formatted'));

      const written = mockWriteFile.mock.calls[0]?.[1] as string;
      expect(written).toContain('\n'); // Pretty printed
      expect(JSON.parse(written)).toHaveLength(1);
    });

    it('creates directory on save', async () => {
      const reg = createPluginRegistry('/deep/nested/path/registry.json');
      await reg.add(createTestEntry('test'));

      expect(mkdir).toHaveBeenCalledWith(
        expect.stringContaining('nested'),
        { recursive: true },
      );
    });

    it('updates existing entry', async () => {
      const reg = createPluginRegistry('/tmp/test-registry.json');
      await reg.add(createTestEntry('plugin'));

      const updated = createTestEntry('plugin');
      updated.manifest.version = '2.0.0';
      await reg.add(updated);

      expect(reg.list()).toHaveLength(1);
      expect(reg.get('plugin')!.manifest.version).toBe('2.0.0');
    });
  });
});
