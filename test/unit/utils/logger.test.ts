import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogger, type LogEntry } from '../../../src/utils/logger.js';

describe('createLogger', () => {
  it('writes JSON to writer function', () => {
    const lines: string[] = [];
    const logger = createLogger('info', (line) => lines.push(line));
    logger.info('test message');
    expect(lines).toHaveLength(1);
    const entry: LogEntry = JSON.parse(lines[0]!);
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('test message');
    expect(entry.timestamp).toBeTruthy();
  });

  it('includes data when provided', () => {
    const lines: string[] = [];
    const logger = createLogger('debug', (line) => lines.push(line));
    logger.debug('with data', { key: 'value' });
    const entry = JSON.parse(lines[0]!);
    expect(entry.data).toEqual({ key: 'value' });
  });

  it('omits data key when not provided', () => {
    const lines: string[] = [];
    const logger = createLogger('debug', (line) => lines.push(line));
    logger.debug('no data');
    const entry = JSON.parse(lines[0]!);
    expect(entry).not.toHaveProperty('data');
  });

  it('filters below min level', () => {
    const lines: string[] = [];
    const logger = createLogger('warn', (line) => lines.push(line));
    logger.debug('skip');
    logger.info('skip');
    logger.warn('keep');
    logger.error('keep');
    expect(lines).toHaveLength(2);
  });

  it('debug level logs everything', () => {
    const lines: string[] = [];
    const logger = createLogger('debug', (line) => lines.push(line));
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    expect(lines).toHaveLength(4);
  });

  it('error level only logs errors', () => {
    const lines: string[] = [];
    const logger = createLogger('error', (line) => lines.push(line));
    logger.debug('skip');
    logger.info('skip');
    logger.warn('skip');
    logger.error('keep');
    expect(lines).toHaveLength(1);
  });

  it('uses default writer (stderr) when none provided', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = createLogger('info');
    logger.info('test default writer');
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0]![0] as string;
    expect(output).toContain('test default writer');
    spy.mockRestore();
  });
});
