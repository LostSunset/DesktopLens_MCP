import os from 'node:os';

export interface PlatformInfo {
  os: 'windows' | 'macos' | 'linux' | 'unknown';
  arch: string;
  nodeVersion: string;
  hostname: string;
}

export function getPlatformInfo(
  platform: string = process.platform,
  arch: string = process.arch,
  nodeVersion: string = process.version,
): PlatformInfo {
  const osMap: Record<string, PlatformInfo['os']> = {
    win32: 'windows',
    darwin: 'macos',
    linux: 'linux',
  };
  return {
    os: osMap[platform] ?? 'unknown',
    arch,
    nodeVersion,
    hostname: os.hostname(),
  };
}

export function isWindows(platform: string = process.platform): boolean {
  return platform === 'win32';
}

export function isMacos(platform: string = process.platform): boolean {
  return platform === 'darwin';
}

export function isLinux(platform: string = process.platform): boolean {
  return platform === 'linux';
}
