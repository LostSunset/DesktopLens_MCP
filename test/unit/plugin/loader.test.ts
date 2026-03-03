import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';
import { loadPlugin, unloadPlugin, type LoadedPlugin } from '../../../src/plugin/loader.js';
import type { PluginManifest } from '../../../src/plugin/manifest.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const FIXTURES_DIR = join(import.meta.dirname, '..', '..', 'fixtures');

function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createTestManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    name: 'test-plugin',
    version: '1.0.0',
    description: 'Test plugin',
    main: 'dist/index.js',
    tools: [
      { name: 'my_tool', description: 'My tool' },
    ],
    ...overrides,
  };
}

function createMockServer() {
  const registeredTools = new Map<string, (params: Record<string, unknown>) => Promise<unknown>>();
  return {
    tool: vi.fn((name: string, _desc: string, _schema: unknown, handler: (params: Record<string, unknown>) => Promise<unknown>) => {
      registeredTools.set(name, handler);
    }),
    registeredTools,
  };
}

describe('loader', () => {
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = createMockLogger();
  });

  describe('loadPlugin', () => {
    it('loads plugin and registers tool', async () => {
      const manifest = createTestManifest();
      const server = createMockServer();
      const pluginDir = join(FIXTURES_DIR, 'test-plugin');

      const loaded = await loadPlugin(manifest, pluginDir, server as unknown as McpServer, logger);

      expect(loaded.manifest).toBe(manifest);
      expect(loaded.handlers.has('my_tool')).toBe(true);
      expect(server.tool).toHaveBeenCalledWith(
        'plugin_test-plugin_my_tool',
        'My tool',
        {},
        expect.any(Function),
      );
      expect(logger.info).toHaveBeenCalledWith('Registered plugin tool: plugin_test-plugin_my_tool');
    });

    it('calls tool handler through MCP wrapper', async () => {
      const manifest = createTestManifest();
      const server = createMockServer();
      const pluginDir = join(FIXTURES_DIR, 'test-plugin');

      await loadPlugin(manifest, pluginDir, server as unknown as McpServer, logger);

      const handler = server.registeredTools.get('plugin_test-plugin_my_tool')!;
      const result = await handler({ key: 'value' }) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toContain('Hello from test plugin');
      expect(result.content[0].text).toContain('value');
    });

    it('warns when plugin does not register handler for declared tool', async () => {
      const manifest = createTestManifest({ name: 'test-plugin-no-handler' });
      const server = createMockServer();
      const pluginDir = join(FIXTURES_DIR, 'test-plugin-no-handler');

      await loadPlugin(manifest, pluginDir, server as unknown as McpServer, logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('did not register handler'),
      );
      expect(server.tool).not.toHaveBeenCalled();
    });

    it('wraps handler errors in MCP error response', async () => {
      const manifest = createTestManifest({
        name: 'test-plugin-error',
        tools: [{ name: 'error_tool', description: 'Throws' }],
      });
      const server = createMockServer();
      const pluginDir = join(FIXTURES_DIR, 'test-plugin-error');

      await loadPlugin(manifest, pluginDir, server as unknown as McpServer, logger);

      const handler = server.registeredTools.get('plugin_test-plugin-error_error_tool')!;
      const result = await handler({}) as { isError: boolean; content: Array<{ text: string }> };
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Handler exploded');
    });

    it('provides prefixed logger to plugin context', async () => {
      const manifest = createTestManifest();
      const server = createMockServer();
      const pluginDir = join(FIXTURES_DIR, 'test-plugin');

      await loadPlugin(manifest, pluginDir, server as unknown as McpServer, logger);

      // The test-plugin fixture calls all four logger methods
      expect(logger.debug).toHaveBeenCalledWith(
        '[plugin:test-plugin] Debug message',
        undefined,
      );
      expect(logger.info).toHaveBeenCalledWith(
        '[plugin:test-plugin] Test plugin activated',
        undefined,
      );
      expect(logger.warn).toHaveBeenCalledWith(
        '[plugin:test-plugin] Warn message',
        undefined,
      );
      expect(logger.error).toHaveBeenCalledWith(
        '[plugin:test-plugin] Error message',
        undefined,
      );
    });

    it('wraps non-Error handler throw in MCP error response', async () => {
      const manifest = createTestManifest({
        name: 'test-plugin-string-error',
        tools: [{ name: 'string_error_tool', description: 'Throws string' }],
      });
      const server = createMockServer();
      const pluginDir = join(FIXTURES_DIR, 'test-plugin-string-error');

      await loadPlugin(manifest, pluginDir, server as unknown as McpServer, logger);

      const handler = server.registeredTools.get('plugin_test-plugin-string-error_string_error_tool')!;
      const result = await handler({}) as { isError: boolean; content: Array<{ text: string }> };
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('raw string error');
    });
  });

  describe('unloadPlugin', () => {
    it('calls deactivate on the module', async () => {
      const deactivate = vi.fn();
      const plugin: LoadedPlugin = {
        manifest: createTestManifest(),
        module: { activate: vi.fn(), deactivate },
        handlers: new Map(),
      };

      await unloadPlugin(plugin, logger);
      expect(deactivate).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Plugin "test-plugin" unloaded');
    });

    it('handles missing deactivate gracefully', async () => {
      const plugin: LoadedPlugin = {
        manifest: createTestManifest(),
        module: { activate: vi.fn() },
        handlers: new Map(),
      };

      await unloadPlugin(plugin, logger);
      expect(logger.info).toHaveBeenCalledWith('Plugin "test-plugin" unloaded');
    });

    it('logs error when deactivate throws Error', async () => {
      const plugin: LoadedPlugin = {
        manifest: createTestManifest(),
        module: {
          activate: vi.fn(),
          deactivate: vi.fn().mockRejectedValue(new Error('cleanup failed')),
        },
        handlers: new Map(),
      };

      await unloadPlugin(plugin, logger);
      expect(logger.error).toHaveBeenCalledWith(
        'Error unloading plugin "test-plugin"',
        { error: 'cleanup failed' },
      );
    });

    it('logs error for non-Error deactivate failure', async () => {
      const plugin: LoadedPlugin = {
        manifest: createTestManifest(),
        module: {
          activate: vi.fn(),
          deactivate: vi.fn().mockRejectedValue('string error'),
        },
        handlers: new Map(),
      };

      await unloadPlugin(plugin, logger);
      expect(logger.error).toHaveBeenCalledWith(
        'Error unloading plugin "test-plugin"',
        { error: 'string error' },
      );
    });
  });
});
