import { describe, it, expect } from 'vitest';
import { getPlatformInfo, isWindows, isMacos, isLinux } from '../../../src/utils/platform.js';

describe('getPlatformInfo', () => {
  it('detects Windows', () => {
    const info = getPlatformInfo('win32', 'x64', 'v20.0.0');
    expect(info.os).toBe('windows');
    expect(info.arch).toBe('x64');
    expect(info.nodeVersion).toBe('v20.0.0');
    expect(typeof info.hostname).toBe('string');
  });

  it('detects macOS', () => {
    expect(getPlatformInfo('darwin').os).toBe('macos');
  });

  it('detects Linux', () => {
    expect(getPlatformInfo('linux').os).toBe('linux');
  });

  it('returns unknown for unsupported platform', () => {
    expect(getPlatformInfo('freebsd').os).toBe('unknown');
  });
});

describe('isWindows', () => {
  it('returns true for win32', () => expect(isWindows('win32')).toBe(true));
  it('returns false for darwin', () => expect(isWindows('darwin')).toBe(false));
});

describe('isMacos', () => {
  it('returns true for darwin', () => expect(isMacos('darwin')).toBe(true));
  it('returns false for win32', () => expect(isMacos('win32')).toBe(false));
});

describe('isLinux', () => {
  it('returns true for linux', () => expect(isLinux('linux')).toBe(true));
  it('returns false for win32', () => expect(isLinux('win32')).toBe(false));
});
