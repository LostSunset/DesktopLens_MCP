import { describe, it, expect } from 'vitest';
import {
  validateManifest,
  namespacedToolName,
  type PluginManifest,
} from '../../../src/plugin/manifest.js';

function validManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    name: 'test-plugin',
    version: '1.0.0',
    description: 'A test plugin',
    main: 'dist/index.js',
    tools: [
      { name: 'my_tool', description: 'Does something' },
    ],
    ...overrides,
  };
}

describe('manifest', () => {
  describe('validateManifest', () => {
    it('validates a correct manifest', () => {
      const result = validateManifest(validManifest());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.manifest).toBeDefined();
    });

    it('rejects manifest with missing name', () => {
      const { name, ...rest } = validManifest();
      const result = validateManifest(rest);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects manifest with invalid name format', () => {
      const result = validateManifest(validManifest({ name: 'Invalid Name!' }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('name'))).toBe(true);
    });

    it('rejects manifest with invalid version format', () => {
      const result = validateManifest(validManifest({ version: 'not-semver' }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('version') || e.includes('semver'))).toBe(true);
    });

    it('rejects manifest with no tools', () => {
      const result = validateManifest(validManifest({ tools: [] }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('tool'))).toBe(true);
    });

    it('rejects manifest with invalid tool name format', () => {
      const result = validateManifest(validManifest({
        tools: [{ name: 'Invalid-Tool', description: 'bad' }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Tool name'))).toBe(true);
    });

    it('rejects manifest with reserved tool names', () => {
      const result = validateManifest(validManifest({
        tools: [{ name: 'screenshot', description: 'conflict!' }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('reserved'))).toBe(true);
    });

    it('detects already installed plugin', () => {
      const result = validateManifest(validManifest(), ['test-plugin']);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('already installed'))).toBe(true);
    });

    it('detects duplicate tool names within plugin', () => {
      const result = validateManifest(validManifest({
        tools: [
          { name: 'dup_tool', description: 'First' },
          { name: 'dup_tool', description: 'Second' },
        ],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate'))).toBe(true);
    });

    it('accepts manifest with optional fields', () => {
      const result = validateManifest(validManifest({
        author: 'Test Author',
        license: 'MIT',
        dependencies: { sharp: '^0.33.0' },
        desktoplensVersion: '>=0.3.0',
      }));
      expect(result.valid).toBe(true);
    });

    it('rejects completely invalid data', () => {
      const result = validateManifest('not an object');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects null data', () => {
      const result = validateManifest(null);
      expect(result.valid).toBe(false);
    });

    it('accepts tool with inputSchema', () => {
      const result = validateManifest(validManifest({
        tools: [
          { name: 'my_tool', description: 'Does something', inputSchema: { type: 'object' } },
        ],
      }));
      expect(result.valid).toBe(true);
    });
  });

  describe('namespacedToolName', () => {
    it('creates namespaced tool name', () => {
      expect(namespacedToolName('my-plugin', 'my_tool')).toBe('plugin_my-plugin_my_tool');
    });

    it('handles various plugin and tool names', () => {
      expect(namespacedToolName('ui-grid', 'overlay')).toBe('plugin_ui-grid_overlay');
    });
  });
});
