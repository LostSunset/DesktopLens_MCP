import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../../src/utils/config.js';

describe('loadConfig', () => {
  it('returns defaults when no env vars set', () => {
    const config = loadConfig({});
    expect(config.port).toBe(9876);
    expect(config.defaultFps).toBe(2);
    expect(config.defaultQuality).toBe('medium');
    expect(config.pluginDir).toBe('~/.desktoplens/plugins');
    expect(config.logLevel).toBe('info');
  });

  it('parses valid env vars', () => {
    const config = loadConfig({
      DESKTOPLENS_PORT: '3000',
      DESKTOPLENS_DEFAULT_FPS: '5',
      DESKTOPLENS_DEFAULT_QUALITY: 'high',
      DESKTOPLENS_PLUGIN_DIR: '/custom/dir',
      DESKTOPLENS_LOG_LEVEL: 'debug',
    });
    expect(config.port).toBe(3000);
    expect(config.defaultFps).toBe(5);
    expect(config.defaultQuality).toBe('high');
    expect(config.pluginDir).toBe('/custom/dir');
    expect(config.logLevel).toBe('debug');
  });

  it('falls back on invalid port', () => {
    expect(loadConfig({ DESKTOPLENS_PORT: 'abc' }).port).toBe(9876);
    expect(loadConfig({ DESKTOPLENS_PORT: '-1' }).port).toBe(9876);
    expect(loadConfig({ DESKTOPLENS_PORT: '0' }).port).toBe(9876);
  });

  it('falls back on invalid fps', () => {
    expect(loadConfig({ DESKTOPLENS_DEFAULT_FPS: 'xyz' }).defaultFps).toBe(2);
  });

  it('falls back on invalid quality', () => {
    expect(loadConfig({ DESKTOPLENS_DEFAULT_QUALITY: 'ultra' }).defaultQuality).toBe('medium');
  });

  it('falls back on invalid log level', () => {
    expect(loadConfig({ DESKTOPLENS_LOG_LEVEL: 'verbose' }).logLevel).toBe('info');
  });

  it('accepts low quality', () => {
    expect(loadConfig({ DESKTOPLENS_DEFAULT_QUALITY: 'low' }).defaultQuality).toBe('low');
  });

  it('accepts warn log level', () => {
    expect(loadConfig({ DESKTOPLENS_LOG_LEVEL: 'warn' }).logLevel).toBe('warn');
  });

  it('accepts error log level', () => {
    expect(loadConfig({ DESKTOPLENS_LOG_LEVEL: 'error' }).logLevel).toBe('error');
  });
});
