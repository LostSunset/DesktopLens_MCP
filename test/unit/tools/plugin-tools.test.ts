import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock marketplace
vi.mock('../../../src/plugin/marketplace.js', () => ({
  searchMarketplace: vi.fn().mockResolvedValue({
    total: 1,
    plugins: [{ name: 'test-plugin', description: 'A test', author: 'user', url: 'https://example.com', stars: 5, updatedAt: '2025-01-01' }],
  }),
}));

// Mock installer
vi.mock('../../../src/plugin/installer.js', () => ({
  installFromLocal: vi.fn().mockResolvedValue({
    success: true,
    pluginName: 'my-plugin',
    version: '1.0.0',
  }),
  uninstallPlugin: vi.fn().mockResolvedValue(true),
}));

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPluginSearch } from '../../../src/tools/plugin-search.js';
import { registerPluginInstall } from '../../../src/tools/plugin-install.js';
import { registerPluginList } from '../../../src/tools/plugin-list.js';
import { registerPluginRemove } from '../../../src/tools/plugin-remove.js';
import { searchMarketplace } from '../../../src/plugin/marketplace.js';
import { installFromLocal, uninstallPlugin } from '../../../src/plugin/installer.js';
import type { PluginRegistry } from '../../../src/plugin/registry.js';

const mockSearchMarketplace = vi.mocked(searchMarketplace);
const mockInstallFromLocal = vi.mocked(installFromLocal);
const mockUninstallPlugin = vi.mocked(uninstallPlugin);

function createMockServer() {
  const handlers = new Map<string, (params: Record<string, unknown>) => Promise<unknown>>();
  return {
    tool: vi.fn((name: string, _desc: string, _schema: unknown, handler: (params: Record<string, unknown>) => Promise<unknown>) => {
      handlers.set(name, handler);
    }),
    handlers,
  };
}

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createMockRegistry(): PluginRegistry {
  return {
    list: vi.fn().mockReturnValue([
      {
        manifest: { name: 'installed-plugin', version: '1.0.0', description: 'Already installed', main: 'dist/index.js', tools: [{ name: 'tool1', description: 'Tool 1' }] },
        installedAt: 1700000000000,
        pluginDir: '/plugins/installed-plugin',
        enabled: true,
      },
    ]),
    get: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    names: vi.fn().mockReturnValue(['installed-plugin']),
    save: vi.fn(),
    load: vi.fn(),
  };
}

describe('plugin tools', () => {
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = createMockLogger();
  });

  describe('plugin_search', () => {
    it('registers and searches plugins', async () => {
      const server = createMockServer();
      registerPluginSearch(server as unknown as McpServer, logger);

      const handler = server.handlers.get('desktoplens_plugin_search')!;
      const result = await handler({ query: 'grid' }) as { content: Array<{ text: string }> };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.total).toBe(1);
      expect(parsed.plugins[0].name).toBe('test-plugin');
    });

    it('returns error when search fails', async () => {
      mockSearchMarketplace.mockResolvedValueOnce({
        plugins: [],
        total: 0,
        error: 'API error',
      });

      const server = createMockServer();
      registerPluginSearch(server as unknown as McpServer, logger);

      const handler = server.handlers.get('desktoplens_plugin_search')!;
      const result = await handler({ query: 'test' }) as { isError: boolean; content: Array<{ text: string }> };

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('API error');
    });
  });

  describe('plugin_install', () => {
    it('installs plugin from local path', async () => {
      const server = createMockServer();
      const registry = createMockRegistry();
      registerPluginInstall(server as unknown as McpServer, registry, logger);

      const handler = server.handlers.get('desktoplens_plugin_install')!;
      const result = await handler({ source: '/path/to/plugin' }) as { content: Array<{ text: string }> };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.installed).toBe(true);
      expect(parsed.plugin_name).toBe('my-plugin');
    });

    it('returns error when install fails', async () => {
      mockInstallFromLocal.mockResolvedValueOnce({
        success: false,
        error: 'invalid manifest',
      });

      const server = createMockServer();
      const registry = createMockRegistry();
      registerPluginInstall(server as unknown as McpServer, registry, logger);

      const handler = server.handlers.get('desktoplens_plugin_install')!;
      const result = await handler({ source: '/bad/path' }) as { isError: boolean; content: Array<{ text: string }> };

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('invalid manifest');
    });
  });

  describe('plugin_list', () => {
    it('lists installed plugins', async () => {
      const server = createMockServer();
      const registry = createMockRegistry();
      registerPluginList(server as unknown as McpServer, registry);

      const handler = server.handlers.get('desktoplens_plugin_list')!;
      const result = await handler({}) as { content: Array<{ text: string }> };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(1);
      expect(parsed.plugins[0].name).toBe('installed-plugin');
      expect(parsed.plugins[0].enabled).toBe(true);
      expect(parsed.plugins[0].tools).toEqual(['tool1']);
    });

    it('returns empty list when no plugins', async () => {
      const server = createMockServer();
      const registry = createMockRegistry();
      (registry.list as ReturnType<typeof vi.fn>).mockReturnValue([]);
      registerPluginList(server as unknown as McpServer, registry);

      const handler = server.handlers.get('desktoplens_plugin_list')!;
      const result = await handler({}) as { content: Array<{ text: string }> };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(0);
    });
  });

  describe('plugin_remove', () => {
    it('removes an installed plugin', async () => {
      const server = createMockServer();
      const registry = createMockRegistry();
      registerPluginRemove(server as unknown as McpServer, registry, logger);

      const handler = server.handlers.get('desktoplens_plugin_remove')!;
      const result = await handler({ plugin_name: 'my-plugin' }) as { content: Array<{ text: string }> };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.removed).toBe(true);
    });

    it('returns error when plugin not found', async () => {
      mockUninstallPlugin.mockResolvedValueOnce(false);

      const server = createMockServer();
      const registry = createMockRegistry();
      registerPluginRemove(server as unknown as McpServer, registry, logger);

      const handler = server.handlers.get('desktoplens_plugin_remove')!;
      const result = await handler({ plugin_name: 'nonexistent' }) as { isError: boolean; content: Array<{ text: string }> };

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('nonexistent');
    });
  });
});
