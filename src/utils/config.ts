export interface DesktopLensConfig {
  port: number;
  defaultFps: number;
  defaultQuality: 'low' | 'medium' | 'high';
  pluginDir: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): DesktopLensConfig {
  const quality = env['DESKTOPLENS_DEFAULT_QUALITY'];
  const validQualities = ['low', 'medium', 'high'] as const;
  const parsedQuality = validQualities.includes(quality as typeof validQualities[number])
    ? (quality as DesktopLensConfig['defaultQuality'])
    : 'medium';

  const logLevel = env['DESKTOPLENS_LOG_LEVEL'];
  const validLevels = ['debug', 'info', 'warn', 'error'] as const;
  const parsedLogLevel = validLevels.includes(logLevel as typeof validLevels[number])
    ? (logLevel as DesktopLensConfig['logLevel'])
    : 'info';

  return {
    port: parsePositiveInt(env['DESKTOPLENS_PORT'], 9876),
    defaultFps: parsePositiveInt(env['DESKTOPLENS_DEFAULT_FPS'], 2),
    defaultQuality: parsedQuality,
    pluginDir: env['DESKTOPLENS_PLUGIN_DIR'] ?? '~/.desktoplens/plugins',
    logLevel: parsedLogLevel,
  };
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
