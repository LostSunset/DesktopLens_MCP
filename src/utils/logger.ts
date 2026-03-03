export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

export function createLogger(
  minLevel: LogLevel = 'info',
  writer: (line: string) => void = (line) => process.stderr.write(line + '\n'),
): Logger {
  const shouldLog = (level: LogLevel): boolean =>
    LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];

  const log = (level: LogLevel, message: string, data?: unknown): void => {
    if (!shouldLog(level)) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(data !== undefined && { data }),
    };
    writer(JSON.stringify(entry));
  };

  return {
    debug: (msg, data) => log('debug', msg, data),
    info: (msg, data) => log('info', msg, data),
    warn: (msg, data) => log('warn', msg, data),
    error: (msg, data) => log('error', msg, data),
  };
}
